// Terraform IntelliSense Lite — test extension
// Demonstrates the three core IntelliSense providers in the VS Code Extension API:
//   1. CompletionItemProvider  -> autocomplete
//   2. HoverProvider           -> hover tooltips
//   3. SignatureHelpProvider   -> parameter definitions for built-in functions
//
// The same pattern works for any proprietary/new language: swap out the
// dictionaries below for your own keywords, functions, and docs.

const vscode = require('vscode');

const LANG = 'terraform';

// ---------------------------------------------------------------------------
// 1. Language data (edit these tables to adapt to any language)
// ---------------------------------------------------------------------------

/** Top-level block keywords */
const BLOCKS = {
  resource: {
    detail: 'resource "<TYPE>" "<NAME>" { ... }',
    doc: 'Declares an infrastructure object, e.g. `resource "aws_instance" "web" { ... }`.',
    snippet: 'resource "${1:aws_instance}" "${2:name}" {\n\t$0\n}'
  },
  variable: {
    detail: 'variable "<NAME>" { ... }',
    doc: 'Declares an input variable. Common arguments: `type`, `default`, `description`, `sensitive`.',
    snippet: 'variable "${1:name}" {\n\ttype        = ${2:string}\n\tdescription = "${3}"\n\tdefault     = ${4:null}\n}'
  },
  output: {
    detail: 'output "<NAME>" { ... }',
    doc: 'Exposes a value from the module. Common arguments: `value`, `description`, `sensitive`.',
    snippet: 'output "${1:name}" {\n\tvalue = ${2}\n}'
  },
  provider: {
    detail: 'provider "<NAME>" { ... }',
    doc: 'Configures a provider plugin, e.g. `provider "aws" { region = "us-east-1" }`.',
    snippet: 'provider "${1:aws}" {\n\tregion = "${2:us-east-1}"\n}'
  },
  module: {
    detail: 'module "<NAME>" { ... }',
    doc: 'Calls a child module. Requires a `source` argument.',
    snippet: 'module "${1:name}" {\n\tsource = "${2:./modules/example}"\n}'
  },
  data: {
    detail: 'data "<TYPE>" "<NAME>" { ... }',
    doc: 'Reads information from an existing external object (a data source).',
    snippet: 'data "${1:aws_ami}" "${2:name}" {\n\t$0\n}'
  },
  locals: {
    detail: 'locals { ... }',
    doc: 'Defines local values usable as `local.<name>` within the module.',
    snippet: 'locals {\n\t${1:name} = ${2:value}\n}'
  },
  terraform: {
    detail: 'terraform { ... }',
    doc: 'Terraform settings block: `required_version`, `required_providers`, `backend`.',
    snippet: 'terraform {\n\trequired_version = ">= ${1:1.5.0}"\n\trequired_providers {\n\t\t${2:aws} = {\n\t\t\tsource  = "${3:hashicorp/aws}"\n\t\t\tversion = "~> ${4:5.0}"\n\t\t}\n\t}\n}'
  }
};

/** Common resource types offered inside `resource "` quotes */
const RESOURCE_TYPES = [
  'aws_instance', 'aws_s3_bucket', 'aws_security_group', 'aws_vpc',
  'aws_subnet', 'aws_iam_role', 'aws_lambda_function', 'aws_db_instance',
  'google_compute_instance', 'google_sql_database_instance', 'google_kms_crypto_key',
  'azurerm_virtual_machine', 'azurerm_storage_account'
];

/** Common attributes offered inside a block body */
const COMMON_ATTRIBUTES = {
  ami:            'AMI ID for an EC2 instance (string).',
  instance_type:  'EC2 instance size, e.g. "t3.micro" (string).',
  tags:           'Map of tags to assign to the resource (map(string)).',
  region:         'Cloud region, e.g. "us-east-1" (string).',
  count:          'Meta-argument: create this many instances of the resource (number).',
  for_each:       'Meta-argument: create one instance per element of a map or set.',
  depends_on:     'Meta-argument: explicit dependency list.',
  provider:       'Meta-argument: select a non-default provider configuration.',
  lifecycle:      'Meta-argument block: create_before_destroy, prevent_destroy, ignore_changes.',
  source:         'Module source address (path, registry, or git URL).',
  type:           'Type constraint for a variable, e.g. string, number, list(string).',
  default:        'Default value for a variable.',
  description:    'Human-readable description.',
  sensitive:      'Marks a value as sensitive so it is redacted in output (bool).',
  value:          'The value an output exports.'
};

/** Built-in functions with parameter definitions for signature help */
const FUNCTIONS = {
  lookup: {
    signature: 'lookup(map, key, default?)',
    doc: 'Retrieves the value of a single element from a map, given its key. Returns `default` if the key is absent.',
    params: [
      { label: 'map',     doc: 'The map to look in.' },
      { label: 'key',     doc: 'The key to retrieve.' },
      { label: 'default', doc: 'Optional value returned when the key does not exist.' }
    ]
  },
  join: {
    signature: 'join(separator, list)',
    doc: 'Produces a string by concatenating all list elements with the given separator.',
    params: [
      { label: 'separator', doc: 'String placed between elements.' },
      { label: 'list',      doc: 'List of strings to join.' }
    ]
  },
  split: {
    signature: 'split(separator, string)',
    doc: 'Divides a string into a list by splitting on the separator.',
    params: [
      { label: 'separator', doc: 'Delimiter to split on.' },
      { label: 'string',    doc: 'The string to split.' }
    ]
  },
  format: {
    signature: 'format(spec, args...)',
    doc: 'Produces a string by formatting values per a printf-style spec, e.g. `format("web-%03d", count.index)`.',
    params: [
      { label: 'spec',    doc: 'Format specification string (%s, %d, %03d, ...).' },
      { label: 'args...', doc: 'Values substituted into the spec.' }
    ]
  },
  length: {
    signature: 'length(value)',
    doc: 'Returns the number of elements in a list/map or characters in a string.',
    params: [{ label: 'value', doc: 'List, map, or string to measure.' }]
  },
  merge: {
    signature: 'merge(maps...)',
    doc: 'Merges maps left-to-right; later maps override earlier keys.',
    params: [{ label: 'maps...', doc: 'Two or more maps to merge.' }]
  },
  concat: {
    signature: 'concat(lists...)',
    doc: 'Combines two or more lists into a single list.',
    params: [{ label: 'lists...', doc: 'Lists to concatenate in order.' }]
  },
  cidrsubnet: {
    signature: 'cidrsubnet(prefix, newbits, netnum)',
    doc: 'Calculates a subnet address within a given IP network prefix.',
    params: [
      { label: 'prefix',  doc: 'Base CIDR block, e.g. "10.0.0.0/16".' },
      { label: 'newbits', doc: 'Number of additional bits to extend the prefix.' },
      { label: 'netnum',  doc: 'Which subnet to select (0-based).' }
    ]
  },
  file: {
    signature: 'file(path)',
    doc: 'Reads the contents of a file at the given path and returns it as a string.',
    params: [{ label: 'path', doc: 'Path to the file, often `${path.module}/...`.' }]
  },
  jsonencode: {
    signature: 'jsonencode(value)',
    doc: 'Encodes a Terraform value as a JSON string.',
    params: [{ label: 'value', doc: 'Any Terraform value.' }]
  },
  toset: {
    signature: 'toset(list)',
    doc: 'Converts a list to a set, removing duplicates. Commonly used with `for_each`.',
    params: [{ label: 'list', doc: 'List value to convert.' }]
  }
};

// ---------------------------------------------------------------------------
// 2. Providers
// ---------------------------------------------------------------------------

/** Autocomplete */
class TerraformCompletionProvider {
  provideCompletionItems(document, position) {
    const line = document.lineAt(position.line).text;
    const beforeCursor = line.substring(0, position.character);
    const items = [];

    // Inside `resource "` or `data "` -> suggest resource types
    if (/(resource|data)\s+"[a-zA-Z0-9_]*$/.test(beforeCursor)) {
      for (const rt of RESOURCE_TYPES) {
        const item = new vscode.CompletionItem(rt, vscode.CompletionItemKind.Class);
        item.detail = 'resource type';
        items.push(item);
      }
      return items;
    }

    // Top-level block keywords (with snippets)
    for (const [name, meta] of Object.entries(BLOCKS)) {
      const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Keyword);
      item.detail = meta.detail;
      item.documentation = new vscode.MarkdownString(meta.doc);
      item.insertText = new vscode.SnippetString(meta.snippet);
      items.push(item);
    }

    // Attributes
    for (const [name, doc] of Object.entries(COMMON_ATTRIBUTES)) {
      const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Property);
      item.detail = 'attribute';
      item.documentation = new vscode.MarkdownString(doc);
      items.push(item);
    }

    // Built-in functions
    for (const [name, meta] of Object.entries(FUNCTIONS)) {
      const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);
      item.detail = meta.signature;
      item.documentation = new vscode.MarkdownString(meta.doc);
      item.insertText = new vscode.SnippetString(name + '($0)');
      item.command = { command: 'editor.action.triggerParameterHints', title: 'trigger hints' };
      items.push(item);
    }

    return items;
  }
}

/** Hover tooltips */
class TerraformHoverProvider {
  provideHover(document, position) {
    const range = document.getWordRangeAtPosition(position, /[a-zA-Z_][a-zA-Z0-9_-]*/);
    if (!range) return undefined;
    const word = document.getText(range);

    if (BLOCKS[word]) {
      const md = new vscode.MarkdownString();
      md.appendCodeblock(BLOCKS[word].detail, 'terraform');
      md.appendMarkdown(BLOCKS[word].doc);
      return new vscode.Hover(md, range);
    }
    if (FUNCTIONS[word]) {
      const md = new vscode.MarkdownString();
      md.appendCodeblock(FUNCTIONS[word].signature, 'terraform');
      md.appendMarkdown(FUNCTIONS[word].doc);
      return new vscode.Hover(md, range);
    }
    if (COMMON_ATTRIBUTES[word]) {
      return new vscode.Hover(new vscode.MarkdownString(`**${word}** — ${COMMON_ATTRIBUTES[word]}`), range);
    }
    return undefined;
  }
}

/** Signature help (parameter definitions) */
class TerraformSignatureHelpProvider {
  provideSignatureHelp(document, position) {
    const line = document.lineAt(position.line).text.substring(0, position.character);

    // Walk backwards to find the innermost unclosed function call
    let depth = 0;
    let callStart = -1;
    for (let i = line.length - 1; i >= 0; i--) {
      const ch = line[i];
      if (ch === ')') depth++;
      else if (ch === '(') {
        if (depth === 0) { callStart = i; break; }
        depth--;
      }
    }
    if (callStart === -1) return undefined;

    const fnMatch = line.substring(0, callStart).match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*$/);
    if (!fnMatch) return undefined;
    const fnName = fnMatch[1];
    const meta = FUNCTIONS[fnName];
    if (!meta) return undefined;

    // Count commas at depth 0 after the call start to find the active parameter
    let activeParam = 0;
    let d = 0;
    for (let i = callStart + 1; i < line.length; i++) {
      const ch = line[i];
      if (ch === '(' || ch === '[' || ch === '{') d++;
      else if (ch === ')' || ch === ']' || ch === '}') d--;
      else if (ch === ',' && d === 0) activeParam++;
    }

    const sig = new vscode.SignatureInformation(meta.signature, new vscode.MarkdownString(meta.doc));
    sig.parameters = meta.params.map(
      p => new vscode.ParameterInformation(p.label, new vscode.MarkdownString(p.doc))
    );

    const help = new vscode.SignatureHelp();
    help.signatures = [sig];
    help.activeSignature = 0;
    help.activeParameter = Math.min(activeParam, meta.params.length - 1);
    return help;
  }
}

// ---------------------------------------------------------------------------
// 3. Activation
// ---------------------------------------------------------------------------

function activate(context) {
  const selector = { language: LANG, scheme: 'file' };

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      selector, new TerraformCompletionProvider(), '"', '.', '_'
    ),
    vscode.languages.registerHoverProvider(selector, new TerraformHoverProvider()),
    vscode.languages.registerSignatureHelpProvider(
      selector, new TerraformSignatureHelpProvider(), '(', ','
    )
  );

  console.log('Terraform IntelliSense Lite activated');
}

function deactivate() {}

module.exports = { activate, deactivate };
