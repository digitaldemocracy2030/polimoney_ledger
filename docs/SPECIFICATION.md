# **Polimoney Ledger \- 機能仕様書 (v3.3 完全版)**

## **1\. 機能概要 (Feature Overview)**

この機能は、政治団体や候補者の会計担当者を対象としています。  
会計担当者が、自身が管理する\*\*「政治団体」または「政治家（候補者）」を登録し、それぞれに紐づく「選挙」\*\*の台帳を作成します。  
v3.0より、**複式簿記**モデルを導入します。ユーザーは、「勘定科目」を使用して日々の取引を「仕訳」として登録します。

役割（ロール）と権限の関係は、Flutterアプリ側で静的に定義されます。  
\*\*管理者（admin）\*\*は、他のユーザー（未登録者含む）をEmailで招待し、新規アカウントを発行できます。  
アカウント発行と認証は、ディープリンクが不要な「OTP（ワンタイムパスコード）」方式を採用します。（詳細は 4\. 認証フロー仕様 を参照）

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

*(2.4〜2.7は v3.0と同様)*

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

### **2.8. メディア（証憑）テーブル**

(v3.0から変更なし)

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

(v3.0から変更なし)

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

(v3.0から変更なし)

* **テーブル名:** profiles

| 列名 (Column Name) | データ型 (Data Type) | 説明 (Description) | 備考 (Notes) |
| :---- | :---- | :---- | :---- |
| id | uuid | ユーザーID | auth.users.idへのFK, 主キー |
| full\_name | text | ユーザーの氏名 | 招待時に表示するため |
| email | text | ユーザーのEmail | auth.users.email と同期。招待検索用 |
| updated\_at | timestamptz | 更新日時 |  |

### **2.11. 役割と権限の定義（アプリ側）**

(v3.2から変更なし)

#### **2.11.1. 権限 (Permission) の定義**

// lib/models/permissions.dart (実装例)

/// アプリ内でチェックされる権限の種類  
enum AppPermission {  
// 仕訳（収支）関連  
submitJournal,   // 仕訳を起票（承認申請）する権限  
registerJournal, // 仕訳を即時登録（自己承認）する権限  
approveJournal,  // 他人の仕訳を承認・却下する権限

// メンバー関連  
manageMembers,     // ★メンバーの招待・削除・役割変更を行う権限 (v3.2 説明更新)

// 台帳設定関連  
editLedgerSettings,  // 台帳名の変更など、設定を編集する権限

// 閲覧権限  
viewLedger,          // 台帳（仕訳一覧など）を閲覧する権限  
}

#### **2.11.2. 役割 (Role) の定義**

(v3.0から変更なし)

// lib/models/roles.dart (実装例)  
enum AppRole { admin, approver, submitter, viewer }  
// ... ( roleFromString, getRoleDisplayName ヘルパー )

#### **2.11.3. 役割と権限の紐付け**

(v3.2から変更なし)

// lib/services/permission\_service.dart (実装例)

/// 各役割が持つ権限の静的な定義マップ  
const Map\<AppRole, Set\<AppPermission\>\> rolePermissions \= {  
// 管理者  
AppRole.admin: {  
AppPermission.viewLedger,  
AppPermission.registerJournal, // ★即時登録（自己承認）  
AppPermission.approveJournal,  // ★他人承認  
AppPermission.manageMembers,   // ★招待・削除・変更権限  
AppPermission.editLedgerSettings,  
},  
// ( ... approver, submitter, viewer ... v3.2と同様)  
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

(v3.2から変更なし)

* **ファイル (推奨):** lib/pages/home\_page.dart

### **3.2. 台帳登録画面 (AddLedgerScreen)**

(v3.2から変更なし)

* **ファイル (推奨):** lib/widgets/add\_ledger\_sheet.dart

### **3.3. 仕訳一覧画面 (JournalListScreen)**

(v3.2から変更なし)

* **ファイル (推奨):** lib/pages/journal\_list\_page.dart

### **3.4. 仕訳登録画面 (AddJournalScreen)**

(v3.2から変更なし)

* **ファイル (推奨):** lib/widgets/add\_journal\_sheet.dart

### **3.5. メディア（証憑）管理画面**

(v3.2から変更なし)

* **ファイル (推奨):** lib/pages/media\_library\_page.dart

### **3.6. （新設）仕訳承認画面 (ApproveJournalScreen)**

(v3.2から変更なし)

* **ファイル (推奨):** lib/widgets/approve\_journal\_sheet.dart

### **3.7. （新設）台帳設定・メンバー管理画面 (LedgerSettingsScreen) (【v3.3 更新】)**

* **ファイル (推奨):** lib/pages/ledger\_settings\_page.dart
* **前提:** (v3.2と同様) ledger\_id と my\_role (文字列) を受け取る。
* **ロジック:** (v3.2と同様) canManageMembers, canEditSettings を決定。
* **レイアウト:** (v3.2と同様)
* **機能:**
    * **\_inviteMember (招待) (【v3.3 更新】 \- OTP方式):**
        * (v3.2のEdge Function呼び出しロジックと同様)
        *
            3. 招待されたユーザーは、**4.2 招待されたユーザーの初回ログイン** のフローに従い、OTPコードと新パスワードを入力して認証を完了する。（※3.7の注釈を 4.2 への参照に変更）
    * **\_removeMember (削除):** (v3.2と同様) ledger\_members から delete。

## **4\. 認証フロー仕様 (【v3.3 新規】)**

アカウント管理と認証は、ディープリンク不要の「OTP（ワンタイムパスコード）」方式を前提として実装する。

### **4.1. 新規アカウント作成（マスターアカウント）**

* **ファイル (推奨):** lib/pages/signup\_page.dart
* **機能:**
    *
        1. ユーザーが Email, Password, 氏名 を入力して「登録」ボタンを押下。
    *
        2. supabase.auth.signUp() を実行。（data: {'full\_name': fullName} も同時に渡し、auth.users.raw\_user\_meta\_data に保存する）
    *
        3. SupabaseからOTP（数字コード）付きの確認メールが送信される。
    *
        4. アプリはOTP入力画面に遷移。
    *
        5. ユーザーがメールで受信したOTPコードを入力し supabase.auth.verifyOtp(email: email, token: otp, type: OtpType.signup) を実行して認証を完了する。
    *
        6. （SupabaseのAuthトリガー（README.md参照）により、profilesテーブルにもfull\_name, emailが自動でコピーされる）

### **4.2. 招待されたユーザーの初回ログイン**

* **ファイル (推奨):** lib/pages/login\_page.dart (または専用の lib/pages/invited\_user\_login\_page.dart)
* **前提:** 招待されたユーザーは、3.7 のフローにより、パスワード未設定のアカウントが作成され、OTPコード付きのメールを受信している。
* **レイアウト:**
    * login\_page.dart に「招待された方はこちら」などのタブ/ボタンを追加する。
    * 遷移先の画面（またはタブ）に以下のフォームを設置する。
        * TextFormField (Email)
        * TextFormField (受信したOTPコード)
        * TextFormField (新しいパスワード)
        * TextFormField (新しいパスワードの確認)
* **機能:**
    *
        1. ユーザーがEmailとOTPコードを入力し「認証」ボタンを押下。
    *
        2. supabase.auth.verifyOtp(email: email, token: otp, type: OtpType.invite) （または OtpType.recovery）を実行し、OTP認証を行う。
    *
        3. 認証が成功したら、続けて入力された「新しいパスワード」を使い supabase.auth.updateUser() を実行し、パスワードを設定する。
    *
        4. パスワード設定後、HomePage (台帳選択画面) に遷移する。

### **4.3. パスワードリセット**

* **ファイル (推奨):** lib/pages/login\_page.dart
* **機能:**
    *
        1. ログイン画面に「パスワードをお忘れですか？」リンクを設置。
    *
        2. タップすると AlertDialog または別画面で Email 入力欄を表示。
    *
        3. supabase.auth.resetPasswordForEmail(email) を実行。（**注意:** Supabase側で「OTPを使用する」設定が有効になっている必要がある）
    *
        4. SupabaseからOTP（数字コード）付きのパスワードリセットメールが送信される。
    *
        5. ユーザーは 4.2 と同様の「Email \+ OTP \+ 新パスワード」入力フォームを使い、パスワードをリセットする。（verifyOtp の type は OtpType.recovery を使用）

