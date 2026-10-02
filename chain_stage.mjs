#!/usr/bin/env node
// Catalog and fulfillment commands for the customer portal API and the hub ledger.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

function text(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} is required`);
  }
  return value.trim();
}

function positive(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return value;
}

export function catalogSku(args) {
  return {
    sku_id: text(args.sku_id, "sku_id"),
    formula_id: text(args.formula_id, "formula_id"),
    name: text(args.name, "sku name"),
  };
}

export function fulfill(args) {
  const kind = text(args.kind, "kind");
  if (kind !== "retail" && kind !== "treatment") {
    throw new Error(`unknown fulfillment kind ${kind}`);
  }
  return {
    fulfillment_id: text(args.fulfillment_id, "fulfillment_id"),
    sku_id: text(args.sku_id, "sku_id"),
    location: text(args.location, "location"),
    milligrams: positive(args.milligrams, "milligrams"),
    kind,
    practitioner_id: kind === "treatment" ? text(args.practitioner_id, "practitioner_id") : null,
  };
}

export function handleStage(request) {
  const command = request?.command;
  const args = request?.args || {};
  try {
    if (command === "catalog_sku") return { ok: true, artifact: catalogSku(args) };
    if (command === "fulfill") return { ok: true, artifact: fulfill(args) };
    return { ok: false, error: `unknown command ${command}` };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  const result = handleStage(JSON.parse(readFileSync(0, "utf8")));
  process.stdout.write(JSON.stringify(result));
  if (!result.ok) process.exit(1);
}
