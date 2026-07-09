#!/usr/bin/env node

// src/cli.ts
import fs from "node:fs/promises";
import process from "node:process";

// src/readme-validate.ts
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
var isAgentHeading = (node) => node.type === "heading" && node.depth === 2 && toString(node).trim() === AGENT_HEADING;
var hasMainHeading = (main2, names) => main2.some((n) => n.type === "heading" && n.depth === 2 && names.includes(toString(n).trim()));
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
  const main2 = parse(content).children;
  const agentHeadings = main2.filter(isAgentHeading);
  if (agentHeadings.length === 0) {
    return { main: main2, agent: null };
  }
  const startIdx = main2.indexOf(agentHeadings[0]);
  const after = main2.slice(startIdx + 1);
  const nextH2 = after.findIndex((n) => n.type === "heading" && n.depth <= 2);
  const blockNodes = nextH2 === -1 ? after : after.slice(0, nextH2);
  const firstSub = blockNodes.findIndex((n) => n.type === "heading" && n.depth >= 3);
  const leadNodes = firstSub === -1 ? blockNodes : blockNodes.slice(0, firstSub);
  const proseNodes = firstSub === -1 ? [] : blockNodes.slice(firstSub);
  return {
    main: main2,
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

// src/readme-validate.ts
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
  const sectionHeadings = blockNodes.filter((n) => n.type === "heading" && n.depth === 3).map((n) => toString2(n).trim());
  const known = sectionHeadings.filter((h) => RECOMMENDED_HEADINGS.includes(h));
  for (const heading of sectionHeadings) {
    if (!RECOMMENDED_HEADINGS.includes(heading)) {
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
  const orderIdx = known.map((h) => RECOMMENDED_HEADINGS.indexOf(h));
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
  const { main: main2, agent } = analyze(content);
  if (!hasMainHeading(main2, INSTALL_HEADINGS)) {
    errors.push('Missing "## Install" (or "Installation") section.');
  }
  if (!hasMainHeading(main2, USAGE_HEADINGS)) {
    errors.push('Missing "## Usage" (or "Getting started" / "Quick start") section.');
  }
  if (!hasMainHeading(main2, [LICENSE_HEADING])) {
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
  const main2 = parse(content).children;
  const title = main2.find((n) => n.type === "heading" && n.depth === 1);
  const searchFrom = title ? main2.indexOf(title) + 1 : 0;
  const firstContent = main2.slice(searchFrom).find((n) => n.type !== "html");
  let description = null;
  if (!firstContent) {
    errors.push("Missing a one-sentence description after the title.");
  } else if (firstContent.type !== "paragraph") {
    errors.push(`First content must be a one-sentence description, not ${firstContent.type}.`);
  } else {
    description = toString2(firstContent).trim();
    if (!description.endsWith(".")) {
      warnings.push("Description should end with a period.");
    }
    if (description.length < 15) {
      warnings.push("Description looks too short to be a real sentence.");
    }
  }
  const hasProps = main2.some(
    (n) => n.type === "heading" && n.depth === 2 && /^(Properties|Props)$/.test(toString2(n).trim())
  );
  if (!hasProps) {
    errors.push('Missing "## Properties" section.');
  }
  if (!hasNodeOfType(main2, ["code"])) {
    errors.push("Missing a code example.");
  }
  return { ok: errors.length === 0, errors, warnings, description };
};

// src/cli.ts
var USAGE = `Usage:
  gravity-readme --package <README.md | URL>
  gravity-readme --component <README.md | URL>`;
var isUrl = (target) => /^https?:\/\//i.test(target);
var load = async (target) => {
  if (isUrl(target)) {
    const response = await fetch(target);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return response.text();
  }
  return fs.readFile(target, "utf8");
};
var report = (label, result) => {
  for (const warning of result.warnings) {
    console.warn(`  \u26A0 ${warning}`);
  }
  if (result.ok) {
    console.log(`\u2713 ${label}`);
    return true;
  }
  console.error(`\u2717 ${label}`);
  for (const error of result.errors) {
    console.error(`  \u2022 ${error}`);
  }
  return false;
};
var main = async () => {
  const [mode, target] = process.argv.slice(2);
  if (mode !== "--package" && mode !== "--component" || !target) {
    console.error(USAGE);
    process.exit(2);
  }
  let content;
  try {
    content = await load(target);
  } catch (error) {
    console.error(`Cannot read ${target}: ${error.message}`);
    process.exit(2);
  }
  if (mode === "--package") {
    const result = validatePackageReadme(content);
    const ok = report(target, result);
    if (ok)
      console.log(`  positioning: "${result.positioning}"`);
    process.exit(ok ? 0 : 1);
  } else {
    const result = validateComponentReadme(content);
    const ok = report(target, result);
    process.exit(ok ? 0 : 1);
  }
};
main();
