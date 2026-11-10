// 用途：装配原有内置命令并提供清单，命令行为和帮助顺序保持不变。
import { HelpCommand } from "./commands/HelpCommand.js";
import { InitCommand } from "./commands/InitCommand.js";
import { CanvasCommand } from "./commands/CanvasCommand.js";
import { CreateCommand } from "./commands/CreateCommand.js";
import { MoveCommand } from "./commands/MoveCommand.js";
import { ScaleCommand } from "./commands/ScaleCommand.js";
import { DeleteCommand } from "./commands/DeleteCommand.js";
import { SetCommand } from "./commands/SetCommand.js";
import { AddToCommand } from "./commands/AddToCommand.js";
import { FrontCommand } from "./commands/FrontCommand.js";
import { BackCommand } from "./commands/BackCommand.js";
import { GroupCommand } from "./commands/GroupCommand.js";
import { UngroupCommand } from "./commands/UngroupCommand.js";
import { TreeCommand } from "./commands/TreeCommand.js";
import { ShowCommand } from "./commands/ShowCommand.js";
import { SaveCommand } from "./commands/SaveCommand.js";
import { ReadCommand } from "./commands/ReadCommand.js";
import { UndoCommand } from "./commands/UndoCommand.js";
import { RedoCommand } from "./commands/RedoCommand.js";
import type { EditorSession } from "../application/EditorSession.js";
import type { CommandDefinition } from "../application/contracts/CommandDefinition.js";
import type { Plugin } from "../application/contracts/Plugin.js";
import type { PluginContext } from "../application/contracts/PluginContext.js";
import type { PluginManifest } from "../application/contracts/PluginManifest.js";
import { ShapeFactory } from "../domain/ShapeFactory.js";

export class BuiltinCommands implements Plugin {
  private readonly session: EditorSession;
  private readonly factory = new ShapeFactory();

  constructor(session: EditorSession) {
    this.session = session;
  }

  get manifest(): PluginManifest {
    return { name: "builtin-commands", contributes: { commands: this.definitions(() => []).map((entry) => entry.name) } };
  }

  activate(context: PluginContext): void {
    for (const definition of this.definitions(() => context.getCommandHelp())) {
      context.registerCommand(definition);
    }
  }

  private definitions(getHelp: PluginContext["getCommandHelp"]): readonly CommandDefinition[] {
    // 回调执行时才取得文档；启动和 help 不要求先 init。
    return [
      { name: "init", syntax: "init [w] [h]", description: "create a canvas (default 800x600)",
        create: (tokens) => new InitCommand(this.session, tokens) },
      { name: "canvas", syntax: "canvas [w] [h]", description: "show or resize the current canvas",
        create: (tokens) => new CanvasCommand(this.session, tokens) },
      { name: "save", syntax: "save [file.svg]", description: "save to a given or previously associated path",
        create: (tokens) => new SaveCommand(this.session, tokens) },
      { name: "read", syntax: "read <file.svg>", description: "load SVG and assign IDs to unnamed shapes",
        create: (tokens) => new ReadCommand(this.session, tokens) },
      { name: "create", syntax: "create <type> <id> [params...] [in <containerId>]", description: "create rect/circle/ellipse/line/text/g",
        create: (tokens) => new CreateCommand(this.session.requireDocument(), this.factory, tokens) },
      { name: "move", syntax: "move <id> <dx> <dy>", description: "move a shape or all descendants of a group",
        create: (tokens) => new MoveCommand(this.session.requireDocument(), tokens) },
      { name: "scale", syntax: "scale <id> <factor>", description: "scale all geometry by a positive factor",
        create: (tokens) => new ScaleCommand(this.session.requireDocument(), tokens) },
      { name: "delete", syntax: "delete <id>", description: "delete a shape and all its descendants",
        create: (tokens) => new DeleteCommand(this.session.requireDocument(), tokens) },
      { name: "set", syntax: "set <id> <attr> <value>", description: "set a supported geometry, style, or text property",
        create: (tokens) => new SetCommand(this.session.requireDocument(), tokens) },
      { name: "addto", syntax: "addto <gid> <id>", description: "move a shape into a container as its last child",
        create: (tokens) => new AddToCommand(this.session.requireDocument(), tokens) },
      { name: "front", syntax: "front <id>", description: "bring a shape to the front among its siblings",
        create: (tokens) => new FrontCommand(this.session.requireDocument(), tokens) },
      { name: "back", syntax: "back <id>", description: "send a shape to the back among its siblings",
        create: (tokens) => new BackCommand(this.session.requireDocument(), tokens) },
      { name: "group", syntax: "group <newGid> <id1> [id2...]", description: "group existing shapes in their original tree order",
        create: (tokens) => new GroupCommand(this.session.requireDocument(), this.factory, tokens) },
      { name: "ungroup", syntax: "ungroup <gid>", description: "replace a non-top-level group with its children",
        create: (tokens) => new UngroupCommand(this.session.requireDocument(), tokens) },
      { name: "tree", syntax: "tree [id]", description: "show the document tree or a selected subtree",
        create: (tokens) => new TreeCommand(this.session.requireDocument(), tokens) },
      { name: "show", syntax: "show <id>", description: "show a shape's attributes and parent",
        create: (tokens) => new ShowCommand(this.session.requireDocument(), tokens) },
      { name: "undo", syntax: "undo", description: "undo the last edit",
        create: (tokens) => new UndoCommand(this.session, tokens) },
      { name: "redo", syntax: "redo", description: "redo the last undone edit",
        create: (tokens) => new RedoCommand(this.session, tokens) },
      { name: "help", syntax: "help", description: "show available commands",
        create: (tokens) => new HelpCommand(tokens, getHelp) },
    ];
  }
}
