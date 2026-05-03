// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import {
  commands,
  DecorationOptions,
  ExtensionContext,
  Position,
  Range,
  TextEditor,
  TextEditorDecorationType,
  window,
  workspace,
  WorkspaceConfiguration
} from "vscode";

// this method is called when vs code is activated
export function activate(context: ExtensionContext): void {

  let decorationTypes: TextEditorDecorationType[] = [];

  let doIt: boolean = false;
  let clearMe: boolean = false;
  let skipAllErrors: boolean = false;

  let activeEditor: TextEditor | undefined = window.activeTextEditor;
  let currentLanguageId = activeEditor?.document.languageId ?? null;

  const config: WorkspaceConfiguration = workspace.getConfiguration("indentRainbow");

  const error_color: string =
    config["errorColor"] || "oklab(.401 .118 .056 /.3)";

  const error_decoration_type: TextEditorDecorationType =
    window.createTextEditorDecorationType({
      backgroundColor: error_color
    });

  const tabmix_color: string = config["tabmixColor"] || "";

  const tabmix_decoration_type: TextEditorDecorationType | null =
    tabmix_color !== ""
      ? window.createTextEditorDecorationType({
        backgroundColor: tabmix_color
      })
      : null;

  const ignoreLinePatternsRaw: (string | RegExp)[] =
    config["ignoreLinePatterns"] || [];

  const ignoreLinePatterns: RegExp[] = ignoreLinePatternsRaw.map(
    (pattern: string | RegExp) => {
      if (typeof pattern === "string") {
        const regParts: RegExpMatchArray | null = pattern.match(
          /^\/(.*?)\/([gim]*)$/
        );
        if (regParts) {
          return new RegExp(regParts[1], regParts[2]);
        }
        try {
          return new RegExp(pattern);
        } catch {
          console.warn("Invalid ignoreLinePatterns entry:", pattern);
          return /$^/; // matches nothing
        }

      }
      return pattern;
    }
  );

  const colorOnWhiteSpaceOnly: boolean =
    config["colorOnWhiteSpaceOnly"] || false;

  const indicatorStyle: string =
    config["indicatorStyle"] || "classic";

  const lightIndicatorStyleLineWidth: number =
    config["lightIndicatorStyleLineWidth"] || 1;

  const colors: string[] = config["colors"] || [
    "oklab(.9169 .0119 .1150 / .07)",
    "oklab(.8262 -.0934 .0496 / .07)",
    "oklab(.8260 .1373 -.0768 / .07)",
    "oklab(.7936 -.0539 -.0022 / .07)"
  ];

  colors.forEach((color: string, index: number) => {
    if (indicatorStyle === "classic") {
      decorationTypes[index] = window.createTextEditorDecorationType({
        backgroundColor: color
      });
    } else if (indicatorStyle === "light") {
      decorationTypes[index] = window.createTextEditorDecorationType({
        borderStyle: "solid",
        borderColor: color,
        borderWidth: `0 0 0 ${lightIndicatorStyleLineWidth}px`
      });
    }
  });

  // Prevent crashes if indicatorStyle is invalid and no decoration types were created
  if (decorationTypes.length === 0) {
    console.warn("indentRainbow: No decoration types created. Decorations disabled.");
    // Prevent updateDecorations from ever running
    doIt = false;
  }

  if (activeEditor) {
    indentConfig();
  }

  if (activeEditor && checkLanguage()) {
    triggerUpdateDecorations();
  }

  window.onDidChangeActiveTextEditor(editor => {
    activeEditor = editor;

    if (editor) {
      indentConfig();
    }

    if (editor && checkLanguage()) {
      triggerUpdateDecorations();
    }
  }, null, context.subscriptions);

  workspace.onDidChangeTextDocument(event => {
    if (activeEditor) {
      indentConfig();
    }

    if (
      activeEditor &&
      event.document === activeEditor.document &&
      checkLanguage()
    ) {
      triggerUpdateDecorations();
    }
  }, null, context.subscriptions);

  function indentConfig(): void {
    const skiplang: string[] =
      config["ignoreErrorLanguages"] || [];

    skipAllErrors = false;

    if (skiplang.length !== 0) {
      if (
        skiplang.indexOf("*") !== -1 ||
        (currentLanguageId &&
          skiplang.indexOf(currentLanguageId) !== -1)
      ) {
        skipAllErrors = true;
      }
    }
  }

  function checkLanguage(): boolean {
    if (activeEditor) {
      if (
        currentLanguageId !== activeEditor.document.languageId
      ) {
        const inclang: string[] =
          config["includedLanguages"] || [];
        const exclang: string[] =
          config["excludedLanguages"] || [];

        currentLanguageId =
          activeEditor.document.languageId;

        doIt = true;

        if (inclang.length !== 0) {
          if (
            inclang.indexOf(currentLanguageId) === -1
          ) {
            doIt = false;
          }
        }

        if (doIt && exclang.length !== 0) {
          if (
            exclang.indexOf(currentLanguageId) !== -1
          ) {
            doIt = false;
          }
        }
      }
    }

    if (clearMe && !doIt && activeEditor) {
      const decor: DecorationOptions[] = [];

      for (const decorationType of decorationTypes) {
        activeEditor.setDecorations(decorationType, decor);
      }

      clearMe = false;
    }

    indentConfig();

    return doIt;
  }

  let timeout: NodeJS.Timeout | null = null;

  function triggerUpdateDecorations(): void {
    if (timeout) clearTimeout(timeout);

    const updateDelay: number = config["updateDelay"] || 100;

    timeout = setTimeout(updateDecorations, updateDelay);
  }

  function updateDecorations(): void {
    const editor: TextEditor | undefined = activeEditor;
    if (!editor) {
      return;
    }

    const regE: RegExp = /^[\t ]+/gm;
    const text: string = editor.document.getText();

    const tabSizeRaw: string | number | undefined = editor.options.tabSize;
    const tabSize: number = typeof tabSizeRaw === "number" ? tabSizeRaw : 4;

    const tabs: string = " ".repeat(tabSize);

    const ignoreLines: number[] = [];

    let error_decorator: DecorationOptions[] = [];
    let tabmix_decorator: DecorationOptions[] = [];

    let decorators: DecorationOptions[][] = [];

    decorationTypes.forEach(() => { decorators.push([]); });
    if (decorators.length === 0) {
      return; // nothing to decorate, avoid crash
    }
    
    let match: RegExpExecArray | null;

    if (!skipAllErrors) {
      for (const ignorePattern of ignoreLinePatterns) {
        ignorePattern.lastIndex = 0;

        let ignore: RegExpExecArray | null;

        while (
          (ignore = ignorePattern.exec(text)) !== null
        ) {
          const pos: Position = editor.document.positionAt(ignore.index);

          const line: number = editor.document.lineAt(pos).lineNumber;

          if (line !== undefined) {
            ignoreLines.push(line);
          }
        }
      }
    }

    const re: RegExp = new RegExp("\t", "g");

    let sc: number = 0;
    let tc: number = 0;

    while ((match = regE.exec(text))) {
      const pos: Position = editor.document.positionAt(match.index);

      const line: number = editor.document.lineAt(pos).lineNumber;

      const skip: boolean = skipAllErrors || ignoreLines.indexOf(line) !== -1;

      const ma: number = match[0].replace(re, tabs).length;

      if (!skip && ma % tabSize !== 0) {
        const startPos: Position = editor.document.positionAt(match.index);

        const endPos: Position = editor.document.positionAt(match.index + match[0].length);

        error_decorator.push({
          range: new Range(startPos, endPos)
        });
      } else {
        const m = match[0];
        const l = m.length;

        let o: number = 0;

        let n: number = 0;

        while (n < l) {
          const s: number = n;

          const startPos: Position = editor.document.positionAt(match.index + n);

          if (m[n] === "\t") {
            n++;
          } else {
            n += tabSize;
          }

          if (colorOnWhiteSpaceOnly && n > l) {
            n = l;
          }

          const endPos: Position = editor.document.positionAt(match.index + n);

          const decoration = {
            range: new Range(startPos, endPos)
          };

          sc = 0;
          tc = 0;

          if (!skip && tabmix_decoration_type) {
            for (let i = s; i < n && i < l; i++) {
              if (m[i] === " ") sc++;
              else if (m[i] === "\t") tc++;
            }
          }

          if (
            sc > 0 &&
            tc > 0 &&
            tabmix_decoration_type
          ) {
            tabmix_decorator.push(decoration);
          } else {
            const idx = o % decorators.length;
            decorators[idx].push(decoration);
          }

          o++;
        }
      }
    }

    decorationTypes.forEach((type, index) => {
      editor.setDecorations(
        type,
        decorators[index]
      );
    });

    editor.setDecorations(
      error_decoration_type,
      error_decorator
    );

    if (tabmix_decoration_type) {
      editor.setDecorations(
        tabmix_decoration_type,
        tabmix_decorator
      );
    }

    clearMe = true;
  }

  workspace.onDidChangeConfiguration(event => {
    if (
      event.affectsConfiguration("indentRainbow")
    ) {
      window
        .showInformationMessage(
          "Reload required for indentRainbow changes.",
          "Reload now",
          "Later"
        )
        .then(action => {
          if (action === "Reload now") {
            commands.executeCommand(
              "workbench.action.reloadWindow"
            );
          }
        });
    }
  });
}