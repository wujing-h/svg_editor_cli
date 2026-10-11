// 用途：验证撤销或重做恢复失败时，栈顶命令保留且可重试。
const assert = require("node:assert/strict");
const test = require("node:test");
const { CommandHistory } = require("../dist/application/CommandHistory.js");
const { EditCommand } = require("../dist/application/EditCommand.js");

class RetryableEdit extends EditCommand {
  failUndo = false;
  failRedo = false;
  applied = false;

  execute() {
    this.applied = true;
    return {};
  }

  undo() {
    if (this.failUndo) {
      throw new Error("cannot restore yet");
    }
    this.applied = false;
    return {};
  }

  redo() {
    if (this.failRedo) {
      throw new Error("cannot restore yet");
    }
    this.applied = true;
    return {};
  }
}

test("failed undo leaves the command available for retry", () => {
  const history = new CommandHistory();
  const command = new RetryableEdit();
  history.execute(command);
  command.failUndo = true;
  assert.throws(() => history.undo(), /cannot restore yet/);
  assert.equal(command.applied, true);
  assert.throws(() => history.redo(), /nothing to redo/);
  command.failUndo = false;
  history.undo();
  assert.equal(command.applied, false);
  assert.throws(() => history.undo(), /nothing to undo/);
});

test("failed redo leaves the command available for retry", () => {
  const history = new CommandHistory();
  const command = new RetryableEdit();
  history.execute(command);
  history.undo();
  command.failRedo = true;
  assert.throws(() => history.redo(), /cannot restore yet/);
  assert.equal(command.applied, false);
  assert.throws(() => history.undo(), /nothing to undo/);
  command.failRedo = false;
  history.redo();
  assert.equal(command.applied, true);
  assert.throws(() => history.redo(), /nothing to redo/);
});
