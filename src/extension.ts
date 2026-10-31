import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

const HEADER_EXTS = ['.h', '.hpp', '.hh', '.hxx'];
const SOURCE_EXTS = ['.cpp', '.cc', '.cxx', '.c'];

/**
 * Команда 1: вставляет "#pragma once" в самое начало текущего файла.
 */
async function insertPragmaOnce(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('Нет открытого файла.');
    return;
  }

  const doc = editor.document;
  if (doc.getText().includes('#pragma once')) {
    vscode.window.showInformationMessage('В этом файле уже есть #pragma once.');
    return;
  }

  await editor.edit((edit: vscode.TextEditorEdit) => {
    edit.insert(new vscode.Position(0, 0), '#pragma once\n\n');
  });
}

/**
 * Проверка имени класса: должен быть корректным идентификатором C++.
 */
function validateClassName(value: string): string | undefined {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    return 'Имя класса должно начинаться с буквы или "_" и содержать только буквы, цифры и "_".';
  }
  return undefined;
}

/**
 * Команда 2: спрашивает имя класса и вставляет заготовку в позицию курсора.
 */
async function createClass(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('Нет открытого файла.');
    return;
  }

  const name = await vscode.window.showInputBox({
    prompt: 'Введите имя класса',
    placeHolder: 'MyClass',
    validateInput: validateClassName,
  });
  if (!name) {
    return; // пользователь отменил ввод
  }

  const snippet = new vscode.SnippetString();
  snippet.appendText(`class ${name} {\npublic:\n`);
  snippet.appendText(`    ${name}();\n`);
  snippet.appendText(`    ~${name}();\n\n`);
  snippet.appendText(`    ${name}(const ${name}&) = delete;\n`);
  snippet.appendText(`    ${name}& operator=(const ${name}&) = delete;\n\n`);
  snippet.appendText('private:\n    ');
  snippet.appendTabstop(1);
  snippet.appendText('\n};\n');

  await editor.insertSnippet(snippet);
}

/**
 * Ищет парный файл (.h -> .cpp и наоборот) в той же папке,
 * а также в соседних папках include/ и src/.
 */
function findCounterpart(filePath: string): string | undefined {
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath, path.extname(filePath));

  let targetExts: string[];
  if (HEADER_EXTS.includes(ext)) {
    targetExts = SOURCE_EXTS;
  } else if (SOURCE_EXTS.includes(ext)) {
    targetExts = HEADER_EXTS;
  } else {
    return undefined;
  }

  const parent = path.dirname(dir);
  const searchDirs = [dir, path.join(parent, 'src'), path.join(parent, 'include')];

  for (const d of searchDirs) {
    for (const e of targetExts) {
      const candidate = path.join(d, base + e);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return undefined;
}

/**
 * Команда 3: переключение между заголовочным файлом и файлом реализации.
 */
async function toggleHeaderSource(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('Нет открытого файла.');
    return;
  }

  const current = editor.document.uri.fsPath;
  const counterpart = findCounterpart(current);

  if (!counterpart) {
    vscode.window.showInformationMessage(
      `Парный файл для "${path.basename(current)}" не найден.`
    );
    return;
  }

  const doc = await vscode.workspace.openTextDocument(counterpart);
  await vscode.window.showTextDocument(doc);
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('cppHelper.insertPragmaOnce', insertPragmaOnce),
    vscode.commands.registerCommand('cppHelper.createClass', createClass),
    vscode.commands.registerCommand('cppHelper.toggleHeaderSource', toggleHeaderSource)
  );
}

export function deactivate(): void {
  // освобождать нечего: все подписки очищаются через context.subscriptions
}
