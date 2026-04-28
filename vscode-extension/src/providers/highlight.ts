import * as vscode from 'vscode'
import { scan } from '../scanner'

/** When the cursor sits on a `@prezl <region>` opener or its matching
 *  `@prezl end`, highlight both lines — same affordance VS Code gives
 *  for matching brackets, but our brackets are comment directives. */
export class PrezlMatchHighlightProvider
  implements vscode.DocumentHighlightProvider
{
  provideDocumentHighlights(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.DocumentHighlight[] {
    const result = scan(document.getText())
    for (const pair of result.pairs) {
      const onOpen = position.line === pair.open.line
      const onEnd = position.line === pair.end.line
      if (!onOpen && !onEnd) continue
      // Only paired regions get the matching-bracket affordance —
      // anchors (kind: 'anchor') aren't openers.
      if (pair.open.kind !== 'region') continue
      return [
        new vscode.DocumentHighlight(
          document.lineAt(pair.open.line).range,
          vscode.DocumentHighlightKind.Text,
        ),
        new vscode.DocumentHighlight(
          document.lineAt(pair.end.line).range,
          vscode.DocumentHighlightKind.Text,
        ),
      ]
    }
    return []
  }
}
