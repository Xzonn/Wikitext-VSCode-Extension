import * as vscode from 'vscode';
export const lang = vscode.env.language;

interface I18nInterface {
  [key: string]: string;
}

const i18nDefault: I18nInterface = {
  "button-yes": "Yes",
  "button-no": "No",
  "button-always": "Always",
  "button-never": "Never",
  "edit-result-nochange": `No changes have occurred. Edit page "$1" (Page ID: "$2") action status is "$3" with Content Model "$4". Is watched: $5.`,
  "edit-result-success": `Edit page "$1" (Page ID: "$2") action status is "$3" with Content Model "$4" (Version: "$6" => "$7", Time: $8). Is watched: $5.`,
  "edit-summary-placeholder": " // Edit via Wikitext Extension for VSCode",
  "enter-host-name": "Please input the host of previewer.",
  "enter-page-name": "Enter the page name here.",
  "enter-summary": "Enter the summary of this edit action.",
  "enter-url-to-ref": "Input the URL that you want to ref.",
  "error": "Error: $1",
  "error-edit": "Error: $1. Your token: $2.",
  "error-getting-token": "Could not get edit token: NEW: $1; OLD: $2",
  "error-i18n": `Interwiki page "$1" in space "$2" are currently not supported. Please try to modify host.`,
  "error-no-host-defined": "No Host Be Defined!\nYou haven't defined the host of previewer yet, please input host value in the dialog box (or in settings) and try again.",
  "error-no-active-editor": "There is no active text editor.",
  "error-no-logged-in": "You are not logged in. Please log in and try again.",
  "error-no-title-given": "Empty Title, Post failed.",
  "error-no-username-or-password": "You have not filled in the user name or password, please go to the settings to edit them and try again.",
  "error-nonexist": `The page "$1" you are looking for does not exist. $2 Do you want to create one?`,
  "error-undefined-or-empty": "The bot is undefined or empty.",
  "fail": "fail",
  "false": "false",
  "from-to": "$1 => $2",
  "login-result-success": `User "$1" (UserID: $2) Login Result is "$3". Login Token is "$4".`,
  "login-ask": "",
  "logout-result-success": "Logout successfully.",
  "page-info-comment": "Please do not remove this struct. It's record contains some important informations of edit. This struct will be removed automatically after you push edits.",
  "pull-result-success": "",
  "success": "success",
  "true": "true",
  "wikitext-edit": "Wikitext: Editing...",
  "wikitext-login": "Wikitext: Login...",
  "wikitext-logout": "Wikitext: Logout...",
  "wikitext-post": "Wikitext: Posting...",
  "wikitext-preview": "Wikitext: Getting view...",
  "wikitext-raw": "Wikitext: Getting code..."
};

const i18nChs: I18nInterface = {
  "edit-result-nochange": `页面内容无变化。编辑页面“$1”（ID：$2），状态为“$3”，内容模型为“$4”。监视状态：$5。`,
  "edit-result-success": `编辑页面“$1”（ID：$2），状态为“$3”，内容模型为“$4”（版本：“$6” → “$7”，时间戳：$8）。监视状态：$5。`,
  "edit-summary-placeholder": " // 通过 VSCode 的 Wikitext 扩展进行编辑",
  "enter-host-name": "请输入要预览的 wiki 的域名。",
  "enter-page-name": "请输入页面名。",
  "enter-summary": "请输入编辑摘要。",
  "enter-url-to-ref": "请输入您想要获取页面的 URL。",
  "error": "错误：$1",
  "error-edit": "错误：$1。您的令牌：$2。",
  "error-getting-token": "无法获取编辑令牌。新：$1，旧：$2。",
  "error-i18n": "“$2”空间中的跨 wiki 页面“$1”目前不受支持。请尝试修改域名。",
  "error-no-active-editor": "没有活动的文本编辑器。",
  "error-no-host-defined": "未定义域名！\n您尚未定义预览的域名，请在对话框（或设置）中输入域名，然后重试。",
  "error-no-logged-in": "您尚未登录。请登录后重试。",
  "error-no-title-given": "没有给定标题，提交失败。",
  "error-no-username-or-password": "您尚未填写用户名或密码。请到设置中进行编辑，然后重试。",
  "error-nonexist": "您尝试获取的页面“$1”不存在。$2是否需要创建？",
  "error-undefined-or-empty": "$1未定义，或为空值。",
  "fail": "失败",
  "false": "否",
  "from-to": "$1 → $2",
  "login-result-success": `用户“$1”（ID：$2）登录结果为“$3”。登录令牌为“$4”。`,
  "logout-result-success": "退出登录成功。",
  "page-info-comment": "请不要删除此段落。它的记录包含了一些重要的编辑信息。提交编辑时，此段落将自动删除。",
  "pull-result-success": `获取页面“$1”，内容模型为“$2”。标准化：$3，重定向：$4。`,
  "success": "成功",
  "true": "是",
  "wikitext-edit": "Wikitext: 正在提交编辑……",
  "wikitext-login": "Wikitext: 正在登录……",
  "wikitext-logout": "Wikitext: 正在退出登录……",
  "wikitext-post": "Wikitext: 正在提交……",
  "wikitext-preview": "Wikitext: 正在获取预览……",
  "wikitext-raw": "Wikitext: 正在获取源代码……"
};

function i18nDict(lang: string | undefined = "") {
  switch (lang) {
    case "zh-cn":
      return i18nChs;
    default:
      return i18nDefault;
  }
}

export function i18n(key: string, lang: string | undefined, ...parameters: string[]): string {
  const langDict = i18nDict(lang);
  key = key.toLowerCase();
  let value = langDict[key] || i18nDict()[key] || key;
  let n = parameters.length;
  while (n--) {
    value = value.split("$" + (n + 1).toString()).join(parameters[n]);
  }
  return value;
}