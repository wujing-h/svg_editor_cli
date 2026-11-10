// 用途：将 XML 位置树适配为 VSCode 原生大纲节点，由宿主负责显示、刷新和点击导航。
import { DocumentSymbol, Range, SymbolKind } from "vscode";
import type { CancellationToken, DocumentSymbolProvider, TextDocument } from "vscode";
import { XmlOutlineParser } from "./XmlOutlineParser.js";
import type { XmlOutlineNode } from "./XmlOutlineNode.js";

export class SvgDocumentSymbolProvider implements DocumentSymbolProvider {
  private readonly parser = new XmlOutlineParser();

  provideDocumentSymbols(document: TextDocument, token: CancellationToken): DocumentSymbol[] {
    if (token.isCancellationRequested || !document.uri.path.toLowerCase().endsWith(".svg")) {
      return [];
    }
    const version = document.version;
    // 读取内存文本，因此未保存的编辑也能进入大纲，不读取磁盘或复用旧版本缓存。
    const nodes = this.parser.parse(document.getText(), () => token.isCancellationRequested);
    if (token.isCancellationRequested || document.version !== version) {
      return [];
    }
    return nodes.map((node) => this.toSymbol(node, document));
  }

  private toSymbol(node: XmlOutlineNode, document: TextDocument): DocumentSymbol {
    const symbol = new DocumentSymbol(
      node.name, "", SymbolKind.Object,
      new Range(document.positionAt(node.start), document.positionAt(node.end)),
      new Range(document.positionAt(node.selectionStart), document.positionAt(node.selectionEnd)),
    );
    // 元素完整区间用于层级和高亮；标签名区间用于点击定位，二者不能混用。
    symbol.children = node.children.map((child) => this.toSymbol(child, document));
    return symbol;
  }
}
