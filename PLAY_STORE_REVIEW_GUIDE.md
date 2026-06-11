# Google Play Store Review Guide
## Shreyartha — Shreyartha Education
**Package:** com.the3cedgeai.app | **Version:** 1.3.0

---

## Overview

Shreyartha is an educational platform for students (K–12 and competitive exam aspirants), parents, school staff, and educational partners across India. It provides AI-powered learning assessments, career guidance, language learning, competitive exam preparation, psychometric assessments, and counselling.

---

## Test Accounts

### Student Account (Full Access)
```
Role:      Student
Email:     reviewer@the3cedge.test
Password:  Review@2024
Access:    All learning modules, dashboard, profile management,
           account deletion flow
```

*If the above test account is unavailable, please contact support@shreyartha.com and we will create one within 2 hours.*

### School Staff Account (Teacher)
```
Role:      Teacher
Email:     teacher.reviewer@the3cedge.test
Password:  Review@2024
Access:    Teacher portal, attendance, academic management
```

### Parent Account
```
Role:      Parent
Email:     parent.reviewer@the3cedge.test
Password:  Review@2024
Access:    Parent portal, child progress tracking
```

---

## Login Flow (Native — No WebView)

1. Open the app — the **landing page** loads immediately (service cards, stats, features)
2. Tap the **🔒 Login ▼** button in the top header
3. A dropdown appears — select your role: **Student / School Staff / Parent / Partner**
4. Enter your email + password on the **native login form**
5. Tap **Login**
6. You are redirected to your role's dashboard (in-app WebView of the learning platform)

> All login screens are fully native React Native forms. No WebView is used for authentication.

---

## Key Features to Review

### 1. Landing Page (No Login Required)
- Opens immediately on app start
- Scroll through: hero banner, 11 service feature cards, stats, testimonials, contact form
- Tap **🔒 Login ▼** in the header to begin the login flow

### 2. Student Dashboard (In-App WebView)
- After student login → the full learning platform loads at `shreyartha.com/student/platform/dashboard`
- Access: Academic IQ, Career Assessment, Language Learning, Competitive Exams, Counselling, Reports, etc.
- Android back button navigates within the dashboard; press again to return to landing page

### 3. Account Deletion
- After logging in as a student, navigate to **Settings / Profile** within the student dashboard
- Account deletion is also available via the web portal at **https://shreyartha.com**
- Alternatively, users may request deletion by emailing **support@shreyartha.com** — accounts are deleted within 7 days
- The backend `DELETE /api/students/delete-account` endpoint is fully implemented and active

### 4. Forgot Password
- On any login screen → tap **Forgot Password?**
- Enter email or phone
- Reset link sent via email/SMS
- Success confirmation shown in-app

### 5. Explore Services (No Login Required)
- Bottom tab → **Explore**
- Browse 11 educational service categories
- Tap any card to see full service description

### 6. AI Support Chatbot (No Login Required)
- Bottom tab → **Support**
- Interactive chatbot to submit inquiries
- Choose category → sub-category → provide details → submit

---

## Permissions Explanation

| Permission | Reason |
|-----------|--------|
| INTERNET | Required for all API calls and WebView content |
| ACCESS_NETWORK_STATE | Detect connectivity before making requests |
| CAMERA | Upload profile photo via camera |
| READ_MEDIA_IMAGES | Select profile photo from gallery |
| RECORD_AUDIO | Audio features in language learning modules |

---

## WebView Usage (Content Only)

After authentication, some educational modules (courses, assessments, reports) open in WebViews pointing to **https://shreyartha.com**. This is intentional — the educational content is served from the same platform. The WebViews:

- Only load pages from `shreyartha.com` (allowlisted)
- Receive the user's JWT token via secure localStorage injection (same-origin)
- Support Android hardware back button
- Show loading indicators
- Handle session expiry (redirect to native login)

Core app functions (login, profile, account deletion, navigation) are all native.

---

## Content Rating

- **Target audience:** Students aged 10+, parents, teachers
- **No violence, no adult content**
- **Educational content:** Academic subjects, career guidance, language learning
- **User data:** Profile info, academic progress — see Privacy Policy at https://shreyartha.com/privacy

---

## Contact

**Developer:** Yathartha Ghosh
**Support Email:** support@shreyartha.com
**Website:** https://shreyartha.com
**Privacy Policy:** https://shreyartha.com/privacy
