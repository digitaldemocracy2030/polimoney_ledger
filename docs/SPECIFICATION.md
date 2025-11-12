# **Polimoney Ledger \- 機能仕様書 (v3.0 完全版)**

## **1\. 機能概要 (Feature Overview)**

この機能は、政治団体や候補者の会計担当者を対象としています。  
会計担当者が、自身が管理する\*\*「政治団体」または「政治家（候補者）」を登録し、それぞれに紐づく「選挙」\*\*の台帳を作成します。  
v3.0より、**複式簿記**モデルを導入します。ユーザーは、Polimoney.xlsx \- 勘定科目マスタ.csv に基づく「勘定科目」（例：現金、普通預金、人件費、寄付）を使用して、日々の取引を「仕訳」として登録します。

UI上は「支出」「収入」「振替」として入力しますが、データは\*\*「仕訳ヘッダ (journals)」**と**「仕訳明細 (journal\_entries)」\*\*として保存され、正確な会計管理を実現します。

役割（ロール）と権限の関係は、v2.10と同様にFlutterアプリ側で静的に定義されます。

## **2\. データモデル (Data Model)**

transactions テーブル (v2.10) を廃止し、accounts, journals, journal\_entries テーブルを新設します。

### **2.1. 勘定科目マスタ (【v3.0 新規】)**

Polimoney.xlsx \- 勘定科目マスタ.csv に基づく、会計の勘定科目を定義するマスターテーブル。  
このテーブルは、OSSユーザーがセットアップ時に README.md のSQLを実行してデータを投入することを前提とします。

* **テーブル名:** accounts

| 列名 (Column Name) | データ型 (Data Type) | 説明 (Description) | 備考 (Notes) |
| :---- | :---- | :---- | :---- |
| id | uuid | 一意なID | 主キー, uuid\_generate\_v4() |
| account\_code | text | 勘定科目コード (任意) | 例: 111 (現金), 511 (人件費) |
| account\_name | text | 勘定科目名 | 必須。例: 「現金」「普通預金」「人件費」「寄附」 |
| account\_type | text | 勘定タイプ | asset (資産), liability (負債), equity (純資産), revenue (収益/収入), expense (費用/支出) |
| report\_category | text | 報告書上の分類 | 必須。例: 「経常経費」「政治活動費」 |
| is\_debit\_positive | boolean | 借方(Debit)がプラス側か | true (資産, 費用), false (負債, 純資産, 収益) |
| is\_active | boolean | 現在使用可能か | デフォルト true |

### **2.2. 仕訳ヘッダ (【v3.0 新規】)**

v2.10の transactions テーブルの「メタデータ」部分を引き継ぎます。

* **テーブル名:** journals

| 列名 (Column Name) | データ型 (Data Type) | 説明 (Description) | 備考 (Notes) |
| :---- | :---- | :---- | :---- |
| id | uuid | 一意なID (仕訳ID) | 主キー, uuid\_generate\_v4() |
| organization\_id | uuid | 紐づく政治団体のID | NULL許容, political\_organizations.idへのFK |
| election\_id | uuid | 紐づく選挙台帳のID | NULL許容, elections.idへのFK |
| journal\_date | date | 仕訳日（取引日） | 必須 |
| description | text | 摘要（取引内容） | 必須。例: 「事務所家賃 5月分」 |
| status | text | 承認ステータス | draft (起票/承認前), approved (承認済)。必須 |
| submitted\_by\_user\_id | uuid | 起票したユーザーID | auth.users.idへの参照。必須 |
| approved\_by\_user\_id | uuid | 承認したユーザーID | status='approved'の場合必須 |
| contact\_id | uuid | 紐づく関係者ID | NULL許容, contacts.idへのFK |
| classification | text | 選挙運動の活動区分 | pre-campaign (立候補準備), campaign (選挙運動)。election\_idが設定されている場合のみ使用 |
| non\_monetary\_basis | text | 金銭以外の見積の根拠 | NULL許容。 |
| notes | text | 備考 | 任意入力。NULL許容 |
| amount\_political\_grant | integer | 政党交付金充当額 | NULL許容, デフォルト0 |
| amount\_political\_fund | integer | 政党基金充当額 | NULL許容, デフォルト0 |
| is\_receipt\_hard\_to\_collect | boolean | 領収証徴収困難フラグ | 必須, デフォルト false |
| receipt\_hard\_to\_collect\_reason | text | 領収証徴収困難理由 | NULL許容。 |
| created\_at | timestamptz | レコード作成日時 | now() |

### **2.3. 仕訳明細 (【v3.0 新規】)**

複式簿記の「借方(Debit)」「貸方(Credit)」を記録します。

* **テーブル名:** journal\_entries

| 列名 (Column Name) | データ型 (Data Type) | 説明 (Description) | 備考 (Notes) |
| :---- | :---- | :---- | :---- |
| id | uuid | 一意なID | 主キー, uuid\_generate\_v4() |
| journal\_id | uuid | 紐づく仕訳ヘッダID | journals.id へのFK (Cascade Delete) |
| account\_id | uuid | 紐づく勘定科目ID | accounts.id へのFK |
| debit\_amount | integer | 借方金額 (円) | 必須, デフォルト 0 |
| credit\_amount | integer | 貸方金額 (円) | 必須, デフォルト 0 |

*(2.4〜2.7は v2.10の 2.1〜2.4 と同じ)*

### **2.4. 政治団体テーブル**

* **テーブル名:** political\_organizations

| 列名 (Column Name) | データ型 (Data Type) | 説明 (Description) | 備考 (Notes) |
| :---- | :---- | :---- | :---- |
| id | uuid | 一意なID (政治団体ID) | 主キー, uuid\_generate\_v4() |
| owner\_user\_id | uuid | 台帳のオーナーユーザーID | auth.users.idへの参照 (RLS用) |
| name | text | 政治団体の名称 | 必須 |
| created\_at | timestamptz | レコード作成日時 | デフォルトで now() |

### **2.5. 政治家テーブル**

* **テーブル名:** politicians

| 列名 (Column Name) | データ型 (Data Type) | 説明 (Description) | 備考 (Notes) |
| :---- | :---- | :---- | :---- |
| id | uuid | 一意なID (政治家ID) | 主キー, uuid\_generate\_v4() |
| owner\_user\_id | uuid | このマスターの管理ユーザーID | auth.users.idへの参照 (RLS用) |
| name | text | 政治家の氏名 | 必須 |
| created\_at | timestamptz | レコード作成日時 | デフォルトで now() |

### **2.6. 選挙テーブル**

* **テーブル名:** elections

| 列名 (Column Name) | データ型 (Data Type) | 説明 (Description) | 備考 (Notes) |
| :---- | :---- | :---- | :---- |
| id | uuid | 一意なID (選挙ID) | 主キー, uuid\_generate\_v4() |
| owner\_user\_id | uuid | 台帳のオーナーユーザーID | auth.users.idへの参照 (RLS用) |
| politician\_id | uuid | 紐づく政治家のID | politicians.idへのFK。必須 |
| election\_name | text | 選挙の名称 | 必須。例: 「2025年 〇〇市議会議員選挙」 |
| election\_date | date | 選挙の投開票日 | 必須 |
| created\_at | timestamptz | レコード作成日時 | デフォルトで now() |

### **2.7. 関係者テーブル**

* **テーブル名:** contacts

| 列名 (Column Name) | データ型 (Data Type) | 説明 (Description) | 備考 (Notes) |
| :---- | :---- | :---- | :---- |
| id | uuid | 一意なID (関係者ID) | 主キー, uuid\_generate\_v4() |
| owner\_user\_id | uuid | このマスターの管理ユーザーID | auth.users.idへの参照 (RLS用) |
| name | text | 氏名 又は 団体名 | 必須 |
| address | text | 住所 | NULL許容 |
| occupation | text | 職業 | NULL許容 |
| created\_at | timestamptz | レコード作成日時 | デフォルトで now() |

### **2.8. メディア（証憑）テーブル (【v3.0 更新】)**

transaction\_id (廃止) の代わりに journal\_id に紐づけます。

* **テーブル名:** media\_assets

| 列名 (Column Name) | データ型 (Data Type) | 説明 (Description) | 備考 (Notes) |
| :---- | :---- | :---- | :---- |
| id | uuid | 一意なID | 主キー, uuid\_generate\_v4() |
| journal\_id | uuid | **紐づく仕訳ヘッダID** | journals.idへのFK |
| uploaded\_by\_user\_id | uuid | アップロードしたユーザーID | auth.users.idへの参照 |
| storage\_path | text | Storage内のファイルパス | 必須。 |
| file\_name | text | 元のファイル名 | 必須 |
| mime\_type | text | ファイルのMIMEタイプ | 必須。 |
| created\_at | timestamptz | アップロード日時 | デフォルトで now() |

### **2.9. 台帳メンバーテーブル**

* **テーブル名:** ledger\_members

| 列名 (Column Name) | データ型 (Data Type) | 説明 (Description) | 備考 (Notes) |
| :---- | :---- | :---- | :---- |
| id | uuid | 一意なID | 主キー, uuid\_generate\_v4() |
| user\_id | uuid | 招待されたユーザーのID | auth.users.idへの参照 |
| organization\_id | uuid | 紐づく政治団体のID | **NULL許容**, political\_organizations.idへのFK |
| election\_id | uuid | 紐づく選挙台帳のID | **NULL許容**, elections.idへのFK |
| role | text | **役割（権限）** | アプリ側で定義した文字列キー。下記 2.11 参照。 例: **admin**, **approver**, **submitter**, **viewer** |
| invited\_by\_user\_id | uuid | 招待したユーザーID | auth.users.idへの参照 |
| created\_at | timestamptz | 招待日時 | デフォルトで now() |

### **2.10. ユーザープロファイル**

* **テーブル名:** profiles

| 列名 (Column Name) | データ型 (Data Type) | 説明 (Description) | 備考 (Notes) |
| :---- | :---- | :---- | :---- |
| id | uuid | ユーザーID | auth.users.idへのFK, 主キー |
| full\_name | text | ユーザーの氏名 | 招待時に表示するため |
| email | text | ユーザーのEmail | auth.users.email と同期。招待検索用 |
| updated\_at | timestamptz | 更新日時 |  |

### **2.11. 役割と権限の定義（アプリ側） (【v3.0 更新】)**

v2.10の Transaction 関連の権限を Journal 関連に修正します。

#### **2.11.1. 権限 (Permission) の定義**

// lib/models/permissions.dart (実装例)

/// アプリ内でチェックされる権限の種類  
enum AppPermission {  
// 仕訳（収支）関連  
submitJournal,   // 仕訳を起票（承認申請）する権限  
registerJournal, // 仕訳を即時登録（自己承認）する権限  
approveJournal,  // 他人の仕訳を承認・却下する権限

// メンバー関連  
manageMembers,     // メンバーの招待・削除・役割変更を行う権限

// 台帳設定関連  
editLedgerSettings,  // 台帳名の変更など、設定を編集する権限

// 閲覧権限  
viewLedger,          // 台帳（仕訳一覧など）を閲覧する権限  
}

#### **2.11.2. 役割 (Role) の定義**

(...v2.10と同様...)

// lib/models/roles.dart (実装例)  
enum AppRole { admin, approver, submitter, viewer }  
// ... ( roleFromString, getRoleDisplayName ヘルパー )

#### **2.11.3. 役割と権限の紐付け**

// lib/services/permission\_service.dart (実装例)

/// 各役割が持つ権限の静的な定義マップ  
const Map\<AppRole, Set\<AppPermission\>\> rolePermissions \= {  
// 管理者  
AppRole.admin: {  
AppPermission.viewLedger,  
AppPermission.registerJournal, // ★即時登録（自己承認）  
AppPermission.approveJournal,  // ★他人承認  
AppPermission.manageMembers,  
AppPermission.editLedgerSettings,  
},

// 承認者  
AppRole.approver: {  
AppPermission.viewLedger,  
AppPermission.submitJournal,  // ★起票のみ（自己承認不可）  
AppPermission.approveJournal, // ★他人承認  
},

// 起票者  
AppRole.submitter: {  
AppPermission.viewLedger,  
AppPermission.submitJournal,  // ★起票のみ  
},

// 閲覧者  
AppRole.viewer: {  
AppPermission.viewLedger,  
},  
};  
// ... ( PermissionService クラス )

## **3\. 画面仕様 (Screen Specifications)**

### **3.1. 台帳選択画面 (LedgerSelectionScreen)**

(...v2.10と同様...)

* **ファイル (推奨):** lib/pages/home\_page.dart
* **機能:**
    * **ListTileタップ:**
        * 引数: ledger\_id (organization\_id or election\_id), my\_role (ledger\_members.role 文字列)
        * 遷移先: JournalListScreen

### **3.2. 台帳登録画面 (AddLedgerScreen)**

(...v2.10と同様...)

* **ファイル (推奨):** lib/widgets/add\_ledger\_sheet.dart

### **3.3. 仕訳一覧画面 (JournalListScreen) (【v3.0 更新】)**

(旧 TransactionListScreen)

* **ファイル (推奨):** lib/pages/journal\_list\_page.dart
* **前提:** ledger\_id (org\_id or elec\_id) と my\_role (文字列) を受け取る。
* **ロジック:**
    * PermissionService を使い、権限（canManageMembers, canApprove など）を決定する。
* **レイアウト:**
    * AppBar (v2.10と同様。canManageMembers で設定アイコン表示制御)
    * body: StreamBuilder を使用。
        * **データ取得:** journals テーブルから、ledger\_id が一致するレコードを journal\_date の降順で取得。
        * **（注意）:** この時点では journal\_entries はJOINしない（一覧表示のパフォーマンスのため）。
    * ListView.builder:
        * ListTile:
            * title: Text(journal.description) (摘要)
            * subtitle: FutureBuilder を使用し、journal.id に紐づく journal\_entries と accounts をJOIN。account.type \== 'expense' または account.type \== 'revenue' の科目の account\_name を表示。
            * leading: status が draft なら Icon(Icons.pending\_actions)、approved なら Icon(Icons.check\_circle)。
            * trailing: FutureBuilder を使用し、journal.id に紐づく journal\_entries から合計金額（SUM(debit\_amount)など）を計算して表示。
* **機能:**
    * **ListTileタップ (変更):**
        * status \== 'draft' かつ canApprove が true の場合:
            * 「仕訳承認画面 (ApproveJournalScreen)」をモーダルで表示する。
    * **FloatingActionButton (変更):**
        * canSubmit または canRegister が false の場合は **非表示**。（viewerのみ）
        * タップすると「仕訳登録画面 (AddJournalScreen)」に遷移。ledger\_idとmy\_role を渡す。
    * **設定アイコンタップ:** (v2.10と同様 LedgerSettingsScreen へ)

### **3.4. 仕訳登録画面 (AddJournalScreen) (【v3.0 更新】)**

(旧 AddTransactionScreen) 複式簿記のUIに対応。

* **ファイル (推奨):** lib/widgets/add\_journal\_sheet.dart
* **前提:** ledger\_id と my\_role (文字列) を受け取る。
* **ロジック:**
    * final AppRole myAppRole \= roleFromString(widget.my\_role);
    * final bool canRegister \= permissionService.hasPermission(myAppRole, AppPermission.registerJournal);
* **レイアウト:**
    * AppBar の ElevatedButton のテキストを canRegister に応じて「登録（承認済み）」「承認申請（起票）」に動的変更。(v2.10と同様)
    * Form ウィジェットでラップされた ListView
    * **入力フォーム:**
        * DatePicker (仕訳日)
        * TextFormField (摘要) \- 例: 「事務所家賃 5月分」
        * SegmentedButton (取引タイプ) \- \_entryType (State変数) に連動
            * expense (支出), revenue (収入), transfer (振替)
        * TextFormField (金額) \- \`TextInputType.number

