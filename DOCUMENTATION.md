# 🛡️ LCU FindMe — Campus Property Recovery Platform
## Complete System Documentation, Database Schema & Operational Logic Flows

---

## 1. Executive System Architecture

**LCU FindMe** is an institutional lost-and-found operations platform designed for **Lead City University (LCU), Ibadan**. It connects students, campus security officers, and administrators through a synchronized system that pairs digital reports with physical property custody.

### Technology Stack
* **Frontend:** Vanilla JavaScript (ES6+), HTML5, Semantic CSS3 with CSS Custom Properties, Canvas image compression, PWA Service Worker (`sw.js`).
* **Backend:** Node.js with Express REST APIs, JWT Bearer Token Authentication, Bcrypt password hashing.
* **Database:** MongoDB Atlas (Mongoose ODM).
* **Communication & Mail:** Brevo (Sendinblue) Transactional SMTP API with branded responsive HTML email templates.
* **Physical Tracking:** Client-side QR generation (`qrGenerator.js` / HTML5 Canvas) & QR camera barcode scanner (`html5-qrcode`).

---

## 2. Entity-Relationship (ER) Database Diagram

```mermaid
erDiagram
    USER ||--o{ ITEM : "reports"
    USER ||--o{ VERIFICATION_LOG : "claims custody"
    ITEM ||--o{ CLAIM : "contains (embedded)"
    ITEM ||--o| VERIFICATION_LOG : "final custody handover"
    USER ||--o{ ALERT : "broadcasts (admin only)"

    USER {
        ObjectId _id PK
        string name
        string matricNumber UK
        string email UK
        string password "bcrypt hashed"
        string role "student | staff | admin"
        string faculty
        string department
        string phoneNumber
        string level "100 | 200 | 300 | 400 | etc"
        boolean isVerified "Email OTP status"
        string emailVerificationOTP
        string resetPasswordOTP
        date resetPasswordOTPExpires
        boolean isActivated "One-time key clearance"
        boolean activationPaid "₦1,000 fee status"
        number activationAmount "Default 1000"
        string activationPaymentRef
        string activationOTP "6-digit key"
        date activationOTPExpires
        date activatedAt
        date createdAt
        date updatedAt
    }

    ITEM {
        ObjectId _id PK
        string title
        string type "lost | found"
        string category "electronics | documents | keys | etc"
        string location "Campus building / area"
        date date "Incident date"
        string description
        string reporterName
        string reporterContact
        string reporterEmail
        string reporterMatric
        string reporterFaculty
        string reporterDept
        string reporterLevel
        string status "active | returned"
        string image "Base64 data URL (max 400px)"
        CLAIM[] verificationClaims "Embedded claim requests"
        date createdAt
        date updatedAt
    }

    CLAIM {
        ObjectId _id PK
        string claimantName
        string claimantMatric
        string claimDetails "Proof of ownership"
        string claimantEmail
        string claimantPhone
        string claimantFaculty
        string claimantDept
        string claimantLevel
        string status "pending | accepted | declined"
        boolean resolved
        date claimDate
    }

    VERIFICATION_LOG {
        ObjectId _id PK
        string itemId FK
        string itemTitle
        string claimantName
        string claimantId "Matric or ID"
        string claimantEmail
        string claimantPhone
        string officerName "Handover officer"
        string station "Security Post"
        string notes "Audit notes"
        date timestamp
    }

    ALERT {
        ObjectId _id PK
        string title
        string message
        string priority "info | warning | urgent"
        string postedBy
        boolean active
        date createdAt
    }
```

---

## 3. Core Logic & Workflow Diagrams

### 3.1 Student Authentication & Account Security Flow

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant UI as index.html / app.js
    participant API as auth.js Route
    participant DB as MongoDB (User)
    participant Mail as Brevo SMTP

    Student->>UI: Enter Registration Details
    UI->>API: POST /api/auth/register
    API->>DB: Check if email/matric exists
    alt Account unverified
        API->>DB: Create User (isVerified: false)
        API->>Mail: Dispatch 6-digit email OTP
        Mail-->>Student: Deliver verification code to inbox
        API-->>UI: 201 Created (Requires OTP)
        UI->>Student: Display OTP Verification Modal
        Student->>UI: Input 6-digit OTP
        UI->>API: POST /api/auth/verify-otp
        API->>DB: Compare OTP & set isVerified = true
        API->>Mail: Send Welcome Email
        API-->>UI: Return JWT Token & User Payload
        UI->>Student: Redirect to dashboard.html
    else Duplicate verified account
        API-->>UI: 400 Bad Request
    end
```

---

### 3.2 One-Time Security Activation Key Workflow

To protect student identities and ensure accountable use, students activate their dashboard clearance with a simulated institutional one-time fee:

```mermaid
flowchart TD
    Start([Student Opens Dashboard]) --> CheckAct{isActivated == true?}
    CheckAct -- Yes --> FullAccess[Full Operations Unlocked: Report Items, Submit Claims]
    CheckAct -- No --> ShowBanner[Display Activation Banner & Lock Tags]
    ShowBanner --> ClickPay[Student clicks 'Pay & Activate Now']
    ClickPay --> PayModal[Select Payment Simulation: Card / Transfer / USSD]
    PayModal --> SubmitPay[POST /api/auth/initiate-activation-payment]
    SubmitPay --> GenKey[Generate 6-digit Activation Key + Ref: LCU-ACT-...]
    GenKey --> MailKey[Send Activation Key to Student Email via Brevo]
    MailKey --> ShowOTPModal[Display 6-Digit Key Verification Card]
    ShowOTPModal --> EnterKey[Student Enters 6-Digit Code]
    EnterKey --> VerifyKey[POST /api/auth/verify-activation-otp]
    VerifyKey --> CheckMatch{Key Matches & Not Expired?}
    CheckMatch -- No --> ErrorToast[Show Invalid / Expired Code Toast] --> ShowOTPModal
    CheckMatch -- Yes --> MarkActive[Update User: isActivated = true, activationPaid = true]
    MarkActive --> MailWelcome[Dispatch Official Lead City University Welcome Letter]
    MarkWelcome --> Confetti[Trigger Celebration Modal & Confetti Canvas]
    Confetti --> FullAccess
```

---

### 3.3 Item Reporting & Fuzzy Auto-Matching Flow

```mermaid
flowchart TD
    A[Student clicks 'Report an Item'] --> B[Check Account Activation]
    B -- Not Activated --> C[Show Activation Warning Modal]
    B -- Activated --> D[Open Report Modal]
    D --> E[Upload Item Image]
    E --> F[Client-side Canvas: Resize to 400px & Compress to 70% JPEG]
    F --> G[Fill Title, Category, Location, Date, Description]
    G --> H[Submit Report: POST /api/items]
    H --> I[Tokenize Title: lowercase, remove punctuation, words >= 3 chars]
    I --> J{Search DB for opposite type with same category}
    J -- Found match --> K[Pair Auto-Match Candidate in Response]
    J -- No match --> L[Save Record with status: 'active']
    K --> M[Display Match Found Modal to Reporter]
    L --> N[Item instantly appears on Campus Listings & Overview]
```

---

### 3.4 Verification, Claiming & Custody Handover Flow

```mermaid
sequenceDiagram
    autonumber
    actor Owner as Claiming Student
    participant Dash as dashboard.html (Browse)
    participant Svr as backend/routes/items.js
    actor Admin as CSO Duty Officer
    participant AdminUI as admin.html (Claims Inbox)
    participant Slip as slip.html / Print Modal

    Owner->>Dash: Locate item in Browse Listings
    Owner->>Dash: Click 'Claim Item' (Provide identifying proof/details)
    Dash->>Svr: POST /api/items/:id/claim (Bearer JWT)
    Note over Svr: Binds req.user identity, checks not already claimed/returned
    Svr-->>Dash: 200 Claim Registered (Pending Review)
    Dash->>Owner: Display Ambassador Instruction Modal & Reference
    
    Admin->>AdminUI: Open Security Console -> 'Claims & Disputes Inbox'
    AdminUI->>Admin: Displays pending claim card with student proof
    Admin->>AdminUI: Inspect proof & click '✓ Accept & Release'
    AdminUI->>Svr: PUT /api/items/:id/claims/:claimId/respond { action: 'accept' }
    
    rect rgb(240, 253, 244)
        Svr->>Svr: Set claim.status = 'accepted'
        Svr->>Svr: Set item.status = 'returned'
        Svr->>Svr: Auto-decline any competing rival claims
        Svr->>Svr: Auto-record permanent VerificationLog ledger entry
    end
    
    Svr-->>AdminUI: Handover Confirmed
    AdminUI->>Slip: Auto-open Official Printable Release Slip
    Admin->>Slip: Print Certificate of Handover (Physical sign-off)
    Owner->>Dash: Receives real-time notification: 'Security accepted your claim'
```

---

## 4. Role-Based Access Control (RBAC) & Default Credentials

| Portal Page | Access Scope | Role Required | Default Credentials |
|:---|:---|:---|:---|
| `index.html` | Public landing, student login, registration, password recovery | Everyone (`public`) | Any registered student |
| `dashboard.html` | Student personal reports, claims submission, browse listings, profile | Authenticated student / staff | Created during sign up |
| `admin.html` | Security Operations Center: claims inbox, student directory, intake, custody ledger, QR scanner | `admin` | **Email:** `admin@lcu.edu.ng`<br>**Password:** `admin123` |
| `slip.html` | Standalone property inspection and official release certification via QR | `public` / physical scan | Open to any valid `?item=<id>` |

---

## 5. End-to-End Operational Guide

### 5.1 Student User Walkthrough

1. **Sign Up / Login:**
   * Go to `index.html`.
   * Fill out the student registration form using your **LCU Matriculation Number** (e.g. `LCU/UG/23/25454`) and active email.
   * Check your email for the 6-digit OTP to verify your account.
2. **Dashboard Overview:**
   * Once logged in, your personal metrics are displayed at the top: **My Total Reports**, **Active Lost Reports**, **Items Returned**, and **Campus Listings**.
   * Clicking **any metric card** automatically routes you directly to its respective page or pre-filtered tab.
3. **One-Time Security Activation:**
   * Before reporting or claiming, click **"Pay & Activate Now"**.
   * Confirm the payment simulation to receive your **6-Digit Activation Key** via email.
   * Enter the code to permanently unlock all dashboard privileges.
4. **Reporting Lost or Found Property:**
   * Tap the **"+" Report** button (on desktop: top-right banner; on mobile: floating pill center FAB).
   * Upload a photo (compressed automatically on-device) and provide description, location, and date.
5. **Claiming a Recovered Item:**
   * Go to **Browse Listings**, find the item, and tap **"Claim Item"**.
   * Input confidential proof of ownership (e.g., serial number, distinctive scratch, wallpaper description).
   * Visit the Campus Security Desk (Gate A) to receive your property.

---

### 5.2 Campus Security Officer (CSO) Walkthrough

1. **Accessing the Console:**
   * Open `admin.html`. The screen displays the locked **Security Portal Gate**.
   * Enter `admin@lcu.edu.ng` and password `admin123`.
2. **Operations Dashboard (Tab 1):**
   * Real-time KPI counters (Total, Active Lost, Active Found, Returned, Pending Claims).
   * Review all campus items, filter by status (`claims_pending`, `active`, `returned`), or export full CSV inventory.
3. **Claims & Disputes Inbox (Tab 2):**
   * Review incoming student claims.
   * Compare claimant details against the item record.
   * Click **"✓ Accept & Release"** to grant ownership, or **"Decline"** if proof is insufficient.
4. **Permanent Chain of Custody Ledger (Tab 3):**
   * Every accepted claim and manual handover is permanently immutably logged with timestamp, officer name, claimant ID, and proof notes.
   * Export handover ledger to CSV for campus audits.
5. **Student User Directory (Tab 4):**
   * Search students by name, matric number, faculty, or department.
   * Security officers can **manually toggle activation** if a student pays cash directly at the desk.
6. **Security Property Intake (Tab 5):**
   * Direct intake of found items handed in by cleaners, lecturers, or anonymous students.
   * Assigns intake storage bin codes (e.g. `BIN-A3`) and immediately posts item to the campus board.
7. **QR Barcode Scanner:**
   * Click **"Scan QR Tag"** in the top bar to open the camera scanner or enter an item ID manually to pull up any item's custody slip.

---

## 6. Key REST API Endpoint Reference

| Method | Endpoint | Protection | Description |
|:---|:---|:---|:---|
| `POST` | `/api/auth/register` | Public | Register new student or staff account |
| `POST` | `/api/auth/verify-otp` | Public | Verify 6-digit registration OTP |
| `POST` | `/api/auth/login` | Public | Authenticate user & return JWT token |
| `POST` | `/api/auth/initiate-activation-payment` | JWT User | Simulate activation fee & dispatch email key |
| `POST` | `/api/auth/verify-activation-otp` | JWT User | Verify activation key & unlock dashboard |
| `GET` | `/api/items` | Public | Query filtered items (type, category, search) |
| `POST` | `/api/items` | JWT (Activated) | Submit new lost or found property report |
| `POST` | `/api/items/:id/claim` | JWT (Activated) | Submit ownership verification claim |
| `PUT` | `/api/items/:id/claims/:claimId/respond`| Admin Only | Accept or decline student claim |
| `PUT` | `/api/items/:id/resolve` | Admin Only | Mark item as returned and close claims |
| `GET` | `/api/admin/stats` | Admin Only | Aggregate security metrics & analytics |
| `GET` | `/api/admin/users` | Admin Only | Search and filter campus student directory |
| `PUT` | `/api/admin/users/:id/activation` | Admin Only | Security override for student activation |
| `POST` | `/api/admin/verifications` | Admin Only | Record in-person physical custody handover |
| `POST` | `/api/admin/intake` | Admin Only | Direct gate intake of recovered property |
| `POST` | `/api/admin/alerts` | Admin Only | Broadcast campus security notices |

