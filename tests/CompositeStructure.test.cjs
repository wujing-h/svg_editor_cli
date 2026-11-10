// 用途：验证完整子树接入、复合部件保护，以及结构操作和历史恢复的失败原子性。
const assert = require("node:assert/strict");
const test = require("node:test");
const { GroupShape, RectShape, TextShape } = require("pj/plugin-api");
const { SvgDocument } = require("../dist/domain/SvgDocument.js");
const { ShapeFactory } = require("../dist/domain/ShapeFactory.js");
const { ShapeRegistry } = require("../dist/application/ShapeRegistry.js");
const { EditorSession } = require("../dist/application/EditorSession.js");
const { CommandLineParser } = require("../dist/cli/CommandLineParser.js");
const { CreateCommand } = require("../dist/builtins/commands/CreateCommand.js");
const createDispatcher = require("./helpers/createDispatcher.cjs");
const { ProtectedGroup } = require("./helpers/ProtectedGroup.cjs");

const rect = (id) => new RectShape(id, 0, 0, 10, 20);
const snapshot = (document) => document.getRootShapes().map((shape) => shape.describe());
const setup = () => {
  const document = new SvgDocument(400, 300);
  const panel = new ProtectedGroup("panel");
  document.insert(panel);
  document.insert(new GroupShape("outside"));
  document.insert(rect("extra"), "panel");
  return { document, panel, extra: document.findShape("extra") };
};

test("detached nested trees attach, remove and restore with every ID and parent preserved", () => {
  const leaf = rect("leaf");
  const nested = new GroupShape("nested", {}, [leaf]);
  const panel = new ProtectedGroup("panel", [rect("panel-body"), new TextShape("panel-caption", 0, 0, "title"), nested]);
  assert.equal(leaf.parent, nested);
  assert.equal(nested.parent, panel);
  assert.equal(leaf.document, undefined);
  const document = new SvgDocument(400, 300);
  document.insert(panel);
  const before = snapshot(document);
  for (const shape of [panel, ...panel.children, leaf]) {
    assert.equal(document.findShape(shape.id), shape);
    assert.equal(shape.document, document);
  }
  const location = document.remove("panel");
  assert.equal(panel.parent, undefined);
  assert.equal(leaf.parent, nested);
  assert.equal(leaf.document, undefined);
  assert.throws(() => document.findShape("leaf"), /no such shape/);
  document.restore(location);
  assert.deepEqual(snapshot(document), before);
  assert.equal(document.findShape("leaf"), leaf);
});

test("failed offline construction never claims earlier children", () => {
  const active = rect("active");
  new SvgDocument(10, 10).insert(active);
  const attached = rect("attached");
  const owner = new GroupShape("owner", {}, [attached]);
  for (const invalid of [active, attached, rect("root"), rect("first")]) {
    const first = rect("first");
    assert.throws(() => new GroupShape("root", {}, [first, invalid]), /already/);
    assert.equal(first.parent, undefined);
    assert.equal(first.document, undefined);
  }
  const repeated = rect("repeated");
  assert.throws(() => new GroupShape("root", {}, [repeated, repeated]), /id already exists/);
  assert.equal(repeated.parent, undefined);
  assert.equal(attached.parent, owner);
});

test("all subtree IDs and custom rules are checked before document insertion", () => {
  const document = new SvgDocument(400, 300);
  document.insert(rect("panel-caption"));
  const panel = new ProtectedGroup("panel");
  const before = snapshot(document);
  assert.throws(() => document.insert(panel), /id already exists: panel-caption/);
  assert.deepEqual(snapshot(document), before);
  for (const node of [panel, ...panel.children]) assert.equal(node.document, undefined);
  assert.throws(() => document.findShape("panel-body"), /no such shape/);

  const malformed = new ProtectedGroup("bad", [rect("bad-body")]);
  assert.throws(() => document.insert(malformed), /required component must remain: bad-caption/);
  const registry = new ShapeRegistry();
  registry.register({ name: "protected", create: () => malformed, createFromParameters: () => malformed, createFromSvg: () => malformed });
  const factory = new ShapeFactory(registry);
  for (const run of [() => factory.create("protected", "bad"), () => factory.createFromParameters("protected", "bad", []),
    () => factory.createFromSvg("protected", "bad", {}, "")]) {
    assert.throws(run, /required component must remain: bad-caption/);
  }
  assert.deepEqual(snapshot(document), before);
});

test("required parts cannot be removed, reparented or grouped away; failed operations preserve identity and order", () => {
  const { document, panel } = setup();
  const body = document.findShape("panel-body");
  const before = snapshot(document);
  for (const run of [() => document.remove(body.id), () => document.addTo("outside", body.id),
    () => document.group(new GroupShape("new-group"), [body.id])]) {
    assert.throws(run, /required component must remain: panel-body/);
    assert.deepEqual(snapshot(document), before);
    assert.equal(document.findShape(body.id), body);
    assert.equal(body.parent, panel);
    assert.equal(body.document, document);
    assert.throws(() => document.findShape("new-group"), /no such shape/);
  }
});

test("same-parent reorder validates the final list rather than the temporary removal", () => {
  const { document, panel } = setup();
  const change = document.bringToFront("panel-body");
  assert.deepEqual(panel.children.map((shape) => shape.id), ["panel-caption", "extra", "panel-body"]);
  document.restorePlacement(change.before);
  assert.deepEqual(panel.children.map((shape) => shape.id), ["panel-body", "panel-caption", "extra"]);
});

test("target rejection happens before either parent changes", () => {
  const { document, panel, extra } = setup();
  const target = document.findContainer("outside");
  target.validateChildren = (children) => {
    if (children.includes(extra)) throw new Error("target rejects extra");
  };
  const before = snapshot(document);
  assert.throws(() => document.addTo(target.id, extra.id), /target rejects extra/);
  assert.deepEqual(snapshot(document), before);
  assert.equal(extra.parent, panel);
  const newChild = rect("new-child");
  panel.validateChildren = () => { throw new Error("target rejects insertion"); };
  assert.throws(() => document.insert(newChild, panel.id), /target rejects insertion/);
  assert.equal(newChild.parent, undefined);
  assert.equal(newChild.document, undefined);
  assert.deepEqual(snapshot(document), before);
});

test("restore and restorePlacement also validate the target before changing lists", () => {
  for (const remove of [true, false]) {
    const { document, panel, extra } = setup();
    const location = remove ? document.remove(extra.id) : document.addTo("outside", extra.id).before;
    const originalValidation = panel.validateChildren.bind(panel);
    panel.validateChildren = (children) => {
      originalValidation(children);
      if (children.includes(extra)) throw new Error("restoration rejected");
    };
    const before = snapshot(document);
    assert.throws(() => remove ? document.restore(location) : document.restorePlacement(location), /restoration rejected/);
    assert.deepEqual(snapshot(document), before);
    assert.equal(extra.parent, remove ? undefined : document.findContainer("outside"));
    assert.equal(extra.document, remove ? undefined : document);
    panel.validateChildren = originalValidation;
    if (remove) document.restore(location); else document.restorePlacement(location);
    assert.equal(extra.parent, panel);
  }
});

test("grouping restore preflights every affected container and can retry after rejection", () => {
  const { document, panel, extra } = setup();
  const group = new GroupShape("new-group");
  const change = document.group(group, [extra.id]);
  const originalValidation = panel.validateChildren.bind(panel);
  panel.validateChildren = (children) => {
    originalValidation(children);
    if (children.includes(extra)) throw new Error("grouping restore rejected");
  };
  const before = snapshot(document);
  assert.throws(() => document.restoreGrouping(change, false), /grouping restore rejected/);
  assert.deepEqual(snapshot(document), before);
  assert.equal(extra.parent, group);
  assert.equal(document.findShape(group.id), group);
  panel.validateChildren = originalValidation;
  document.restoreGrouping(change, false);
  assert.equal(extra.parent, panel);
  assert.equal(group.document, undefined);
  document.restoreGrouping(change, true);
  assert.equal(extra.parent, group);
});

test("the ungroup capability is checked for nested and top-level composite containers", () => {
  const { document, panel } = setup();
  for (const nested of [false, true]) {
    if (nested) document.addTo("outside", panel.id);
    const before = snapshot(document);
    assert.throws(() => document.ungroup(panel.id), /cannot ungroup composite shape: panel/);
    assert.deepEqual(snapshot(document), before);
  }
});

test("ungroup cannot bypass the parent's candidate-list rule", () => {
  const { document, panel, extra } = setup();
  const group = new GroupShape("nested");
  document.group(group, [extra.id]);
  const originalValidation = panel.validateChildren.bind(panel);
  panel.validateChildren = (children) => {
    originalValidation(children);
    if (children.includes(extra)) throw new Error("promotion rejected");
  };
  const before = snapshot(document);
  assert.throws(() => document.ungroup(group.id), /promotion rejected/);
  assert.deepEqual(snapshot(document), before);
  assert.equal(document.findShape(group.id), group);
  assert.equal(extra.parent, group);
});

test("grouping history checks the ungroup capability before dissolving a group", () => {
  const { document, extra } = setup();
  const group = new GroupShape("nested");
  const change = document.group(group, [extra.id]);
  group.assertCanUngroup = () => { throw new Error("dissolving rejected"); };
  const before = snapshot(document);
  assert.throws(() => document.restoreGrouping(change, false), /dissolving rejected/);
  assert.deepEqual(snapshot(document), before);
  assert.equal(extra.parent, group);
});

test("a provider-created composite is one create history unit and reuses all original objects", () => {
  const registry = new ShapeRegistry();
  const create = (id) => new ProtectedGroup(id);
  registry.register({ name: "protected", create, createFromParameters: create, createFromSvg: (input) => create(input.id) });
  const session = new EditorSession();
  session.initialize(400, 300);
  const document = session.requireDocument();
  const input = new CommandLineParser().parse("create protected panel");
  session.execute(new CreateCommand(document, new ShapeFactory(registry), input.arguments));
  const panel = document.findShape("panel");
  const body = document.findShape("panel-body");
  session.undo();
  assert.deepEqual(document.getRootShapes(), []);
  assert.throws(() => document.findShape(body.id), /no such shape/);
  session.redo();
  assert.equal(document.findShape(panel.id), panel);
  assert.equal(document.findShape(body.id), body);
  assert.equal(body.parent, panel);
  assert.equal(body.document, document);
});

test("CLI history keeps composite operations local and a rejected edit preserves redo", async () => {
  const session = new EditorSession();
  const dispatcher = createDispatcher(session);
  const parser = new CommandLineParser();
  const run = (line) => dispatcher.dispatch(parser.parse(line));
  await run("init");
  const document = session.requireDocument();
  const panel = new ProtectedGroup("panel");
  document.insert(panel);
  const body = document.findShape("panel-body");
  const before = snapshot(document);
  await run("move panel 10 20");
  await run("undo");
  await assert.rejects(run("delete panel-body"), /required component/);
  await run("redo");
  assert.equal(body.describe().geometry.x, 11);
  await run("undo");
  await run("scale panel 2");
  assert.equal(body.describe().geometry.width, 60);
  await run("undo");
  await run("create g outside");
  await run("addto outside panel");
  await run("undo");
  await run("redo");
  assert.equal(panel.parent, document.findContainer("outside"));
  await run("undo");
  await run("undo");
  await run("delete panel");
  assert.equal(panel.document, undefined);
  await run("undo");
  assert.equal(document.findShape(body.id), body);
  assert.deepEqual(snapshot(document), before);
  await run("redo");
  assert.throws(() => document.findShape(body.id), /no such shape/);
});
