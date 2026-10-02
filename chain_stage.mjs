#!/usr/bin/env node
// Catalog SKUs and customer fulfillments for the customer portal.

import { readFileSync } from "node:fs";

const request = JSON.parse(readFileSync(0, "utf8"));
const command = request.command;
const args = request.args || {};

function fail(message) {
  process.stdout.write(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
}

function text(value, label) {
  if (typeof value !== "string" || value.trim() === "") fail(`${label} is required`);
  return value.trim();
}

function positive(value, label) {
  if (!Number.isInteger(value) || value < 1) fail(`${label} must be a positive integer`);
  return value;
}

let artifact;
if (command === "catalog_sku") {
  artifact = {
    sku_id: text(args.sku_id, "sku_id"),
    formula_id: text(args.formula_id, "formula_id"),
    name: text(args.name, "sku name"),
  };
} else if (command === "fulfill") {
  const kind = text(args.kind, "kind");
  if (kind !== "retail" && kind !== "treatment") fail(`unknown fulfillment kind ${kind}`);
  let practitionerId = null;
  if (kind === "treatment") practitionerId = text(args.practitioner_id, "practitioner_id");
  artifact = {
    fulfillment_id: text(args.fulfillment_id, "fulfillment_id"),
    sku_id: text(args.sku_id, "sku_id"),
    location: text(args.location, "location"),
    milligrams: positive(args.milligrams, "milligrams"),
    kind,
    practitioner_id: practitionerId,
  };
} else {
  fail(`unknown command ${command}`);
}

process.stdout.write(JSON.stringify({ ok: true, artifact }));
