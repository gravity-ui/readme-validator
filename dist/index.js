// src/readme-parse.ts
import { toString as toString2 } from "mdast-util-to-string";

// src/readme-ast.ts
import { toString } from "mdast-util-to-string";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
var processor = unified().use(remarkParse).use(remarkGfm);
var parse = (content) => processor.parse(content);
var AGENT_HEADING = "For AI agents";
var INSTALL_HEADINGS = ["Install", "Installation"];
var USAGE_HEADINGS = ["Usage", "Getting started", "Quick start"];
var LICENSE_HEADING = "License";
var RECOMMENDED_HEADINGS = ["When to use", "When not to use", "Common pitfalls"];
var SERVICE_MARKERS = ["<!--SANDBOX-->", "<!--GITHUB_BLOCK-->", "<!--/GITHUB_BLOCK-->"];
var headingKey = (text) => text.trim().toLowerCase();
var matchesHeading = (text, names) => names.some((n) => headingKey(n) === headingKey(text));
var isAgentHeading = (node) => node.type === "heading" && node.depth === 2 && matchesHeading(toString(node), [AGENT_HEADING]);
var hasMainHeading = (main, names, depths = [2]) => main.some(
  (n) => n.type === "heading" && depths.includes(n.depth) && matchesHeading(toString(n), names)
);
var sliceNodes = (content, nodes) => {
  const start = nodes[0]?.position?.start.offset;
  const end = nodes.at(-1)?.position?.end.offset;
  if (start === void 0 || end === void 0)
    return "";
  return content.slice(start, end);
};
var walk = (node, fn) => {
  fn(node);
  if ("children" in node) {
    for (const child of node.children)
      walk(child, fn);
  }
};
var hasNodeOfType = (nodes, types) => {
  let found = false;
  const check = (n) => {
    if (types.includes(n.type))
      found = true;
  };
  for (const node of nodes) {
    if (found)
      break;
    walk(node, check);
  }
  return found;
};
var analyze = (content) => {
  const main = parse(content).children;
  const agentHeadings = main.filter(isAgentHeading);
  if (agentHeadings.length === 0) {
    return { main, agent: null };
  }
  const startIdx = main.indexOf(agentHeadings[0]);
  const after = main.slice(startIdx + 1);
  const nextH2 = after.findIndex((n) => n.type === "heading" && n.depth <= 2);
  const blockNodes = nextH2 === -1 ? after : after.slice(0, nextH2);
  const firstSub = blockNodes.findIndex((n) => n.type === "heading" && n.depth >= 3);
  const leadNodes = firstSub === -1 ? blockNodes : blockNodes.slice(0, firstSub);
  const proseNodes = firstSub === -1 ? [] : blockNodes.slice(firstSub);
  return {
    main,
    agent: {
      headingCount: agentHeadings.length,
      blockNodes,
      leadNodes,
      block: sliceNodes(content, blockNodes),
      positioning: sliceNodes(content, leadNodes).trim() || null,
      prose: sliceNodes(content, proseNodes).trim() || null
    }
  };
};
var sectionBody = (main, content, names, depths = [2]) => {
  for (const name of names) {
    const idx = main.findIndex(
      (n) => n.type === "heading" && depths.includes(n.depth) && headingKey(toString(n)) === headingKey(name)
    );
    if (idx === -1)
      continue;
    const depth = main[idx].depth;
    const after = main.slice(idx + 1);
    const nextSection = after.findIndex((n) => n.type === "heading" && n.depth <= depth);
    const bodyNodes = nextSection === -1 ? after : after.slice(0, nextSection);
    return sliceNodes(content, bodyNodes).trim() || null;
  }
  return null;
};
var dropSubsections = (nodes, exclude) => {
  const kept = [];
  let skipAboveDepth = null;
  for (const node of nodes) {
    if (skipAboveDepth !== null) {
      if (node.type === "heading" && node.depth <= skipAboveDepth) {
        skipAboveDepth = null;
      } else {
        continue;
      }
    }
    if (node.type === "heading" && matchesHeading(toString(node), exclude)) {
      skipAboveDepth = node.depth;
      continue;
    }
    kept.push(node);
  }
  return kept;
};
var mergedSectionBodies = (main, content, names, depths = [2], exclude = []) => {
  const parts = [];
  main.forEach((node, idx) => {
    if (node.type !== "heading" || !depths.includes(node.depth) || !matchesHeading(toString(node), names)) {
      return;
    }
    const after = main.slice(idx + 1);
    const nextSection = after.findIndex((n) => n.type === "heading" && n.depth <= node.depth);
    const bodyNodes = nextSection === -1 ? after : after.slice(0, nextSection);
    const kept = exclude.length ? dropSubsections(bodyNodes, exclude) : bodyNodes;
    for (const n of kept) {
      const body = sliceNodes(content, [n]).trim();
      if (body)
        parts.push(body);
    }
  });
  return parts.length ? parts.join("\n\n") : null;
};

// src/readme-parse.ts
var extractMeta = (content) => {
  const { agent } = analyze(content);
  if (!agent) {
    return { found: false, block: null, positioning: null };
  }
  return { found: true, block: agent.block, positioning: agent.positioning };
};
var parsePackageReadme = (content) => {
  const { main, agent } = analyze(content);
  return {
    agentPositioning: agent?.positioning ?? null,
    agentProse: agent?.prose ?? null,
    install: sectionBody(main, content, INSTALL_HEADINGS, [2, 3]),
    usage: mergedSectionBodies(main, content, USAGE_HEADINGS, [2], INSTALL_HEADINGS)
  };
};
var parseComponentReadme = (content) => {
  const main = parse(content).children;
  const titleNode = main.find((n) => n.type === "heading" && n.depth === 1);
  const searchFrom = titleNode ? main.indexOf(titleNode) + 1 : 0;
  const firstContent = main.slice(searchFrom).find((n) => n.type !== "html");
  return {
    title: titleNode ? toString2(titleNode).trim() : null,
    description: firstContent?.type === "paragraph" ? toString2(firstContent).trim() || null : null
  };
};

// src/readme-validate.ts
import { toString as toString3 } from "mdast-util-to-string";
var validatePositioning = (positioning, leadNodes, errors) => {
  if (!positioning) {
    errors.push('Positioning (the lead paragraph under "## For AI agents") is missing.');
    return;
  }
  if (positioning.includes("\n")) {
    errors.push("Positioning must be a single line.");
  }
  if (!positioning.endsWith(".")) {
    errors.push("Positioning must end with a period.");
  }
  if (hasNodeOfType(leadNodes, ["link", "linkReference", "image", "imageReference"])) {
    errors.push("Positioning must not contain links, images or badges.");
  }
};
var validateAgentBlock = (agent, errors, warnings) => {
  if (agent.headingCount > 1) {
    errors.push(
      `Found ${agent.headingCount} "## ${AGENT_HEADING}" sections; there must be one.`
    );
  }
  const { blockNodes, leadNodes, positioning } = agent;
  validatePositioning(positioning, leadNodes, errors);
  const sectionHeadings = blockNodes.filter((n) => n.type === "heading" && n.depth === 3).map((n) => toString3(n).trim());
  const recommendedIdx = (h) => RECOMMENDED_HEADINGS.findIndex((r) => headingKey(r) === headingKey(h));
  const known = sectionHeadings.filter((h) => recommendedIdx(h) !== -1);
  for (const heading of sectionHeadings) {
    if (recommendedIdx(heading) === -1) {
      warnings.push(
        `Non-standard section "### ${heading}"; prefer ${RECOMMENDED_HEADINGS.map(
          (h) => `"${h}"`
        ).join(", ")}.`
      );
    }
  }
  if (known.length === 0) {
    warnings.push(
      'The block has only positioning; consider adding "When to use" and/or "Common pitfalls".'
    );
  }
  const orderIdx = known.map(recommendedIdx);
  if (orderIdx.some((v, i) => i > 0 && v < orderIdx[i - 1])) {
    warnings.push(
      `Sections are out of the recommended order (${RECOMMENDED_HEADINGS.join(" \u2192 ")}).`
    );
  }
  let hasBadge = hasNodeOfType(blockNodes, ["image", "imageReference"]);
  const svcHits = /* @__PURE__ */ new Set();
  const scanHtml = (n) => {
    if (n.type !== "html")
      return;
    if (/<img|shields\.io/i.test(n.value))
      hasBadge = true;
    for (const svc of SERVICE_MARKERS) {
      if (n.value.includes(svc))
        svcHits.add(svc);
    }
  };
  for (const node of blockNodes) {
    walk(node, scanHtml);
  }
  if (hasBadge) {
    errors.push("Badges and images are not allowed inside the block.");
  }
  for (const svc of svcHits) {
    errors.push(`Service marker ${svc} must not appear inside the block.`);
  }
};
var validatePackageReadme = (content) => {
  const errors = [];
  const warnings = [];
  const { main, agent } = analyze(content);
  if (!hasMainHeading(main, INSTALL_HEADINGS, [2, 3])) {
    errors.push('Missing "## Install" (or "Installation") section.');
  }
  if (!hasMainHeading(main, USAGE_HEADINGS)) {
    errors.push('Missing "## Usage" (or "Getting started" / "Quick start") section.');
  }
  if (!hasMainHeading(main, [LICENSE_HEADING])) {
    errors.push(
      `Missing "## ${LICENSE_HEADING}" section. Example:

## ${LICENSE_HEADING}

Distributed under the MIT License. See [LICENSE](LICENSE) for details.`
    );
  }
  if (!agent) {
    errors.push(`Missing "## ${AGENT_HEADING}" section.`);
    return { ok: false, errors, warnings, positioning: null };
  }
  validateAgentBlock(agent, errors, warnings);
  return { ok: errors.length === 0, errors, warnings, positioning: agent.positioning };
};
var validateComponentReadme = (content) => {
  const errors = [];
  const warnings = [];
  const main = parse(content).children;
  const title = main.find((n) => n.type === "heading" && n.depth === 1);
  const searchFrom = title ? main.indexOf(title) + 1 : 0;
  const firstContent = main.slice(searchFrom).find((n) => n.type !== "html");
  let description = null;
  if (!firstContent) {
    errors.push("Missing a one-sentence description after the title.");
  } else if (firstContent.type !== "paragraph") {
    errors.push(`First content must be a one-sentence description, not ${firstContent.type}.`);
  } else {
    description = toString3(firstContent).trim();
    if (!description.endsWith(".")) {
      warnings.push("Description should end with a period.");
    }
    if (description.length < 15) {
      warnings.push("Description looks too short to be a real sentence.");
    }
  }
  const hasProps = hasMainHeading(main, ["Properties", "Props"]);
  if (!hasProps) {
    errors.push('Missing "## Properties" section.');
  }
  if (!hasNodeOfType(main, ["code"])) {
    errors.push("Missing a code example.");
  }
  return { ok: errors.length === 0, errors, warnings, description };
};
export {
  extractMeta,
  parseComponentReadme,
  parsePackageReadme,
  validateComponentReadme,
  validatePackageReadme
};
