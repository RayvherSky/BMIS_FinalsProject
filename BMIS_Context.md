System Barangay Incident & Hazard Reporting System (Ticketing Module)
A localized digital helpdesk for residents to report non-emergency public issues and for local officials to track, process, and archive these resolutions.

### 1. Purpose

 Problem it solves Residents currently must travel to the barangay hall during operating hours to report non-emergency issues like uncollected garbage, noise complaints, or broken streetlights. This results in lost verbal complaints, lack of accountability, and a lack of transparency regarding the status of the reported issue.
 Current alternatives or workarounds Residents use fragmented Facebook Messenger group chats, call officials' personal phone numbers, or write in physical logbooks at the barangay hall. These fall short because they offer no standardized tracking, no central database for analytics, and no automated way to notify the resident when the issue is resolved.

### 2. What it does (core scope)

 Account Management Users can register, log in, log out, view profile information, and recover passwords.


 User Management Administrative users can view registered users, update user information, and manage role-based access permissions.


 Core Business Process (Incident Ticketing) A workflow supporting the creation, processing, and completion of incident reports.


 Trigger A resident submits an incident ticket with a category (e.g., Sanitation) and a description.
 Processing An admin reviews the ticket on a centralized dashboard and updates the status to In Progress.
 Completion Once the physical issue is addressed, the admin updates the status to Resolved.


 Archive Module The system separates inactive records from active ones, allowing admins to move resolved or dismissed tickets to an archive, view them, and restore them if necessary.


 End-to-end workflow A resident in Parañaque notices a fallen tree blocking a minor road. They log into the system, fill out the reporting form with the exact street name, and submit. The barangay secretary (Admin) sees the new ticket flagged as Pending. The secretary dispatches the barangay tanod (watchmen) and updates the ticket status to In Progress. The resident checks their profile and sees the status change. Once the tree is cleared, the secretary marks the ticket as Resolved. At the end of the month, the secretary uses the archive module to store all resolved tickets from that period to declutter the active dashboard.

### 3. What it can do (capabilities)

 Extra features The system can filter active tickets by category or status to help admins prioritize workload. It handles role-based access strictly, ensuring residents can only view their own submitted tickets, while admins can view all system-wide tickets.
 Edge cases it can handle If an admin mistakenly archives an unresolved ticket, the system allows the restoration of that specific archived record back to the active queue.


 Hard limits The system cannot handle emergency dispatch (e.g., active fires, violent crimes, medical emergencies). It is strictly a non-emergency queue. It will not process financial transactions, fee collections, or issue legal clearances.

### 4. What it should do (requirements)

 Must-have
 Complete user registration and authentication flow.


 A defined target client acting as a sample organization (e.g., a specific barangay in Parañaque) to guide business requirements.


 Pre-loaded test data featuring at least 10 valid, realistic user accounts with appropriate roles (Admin vs. Resident) prior to demonstration.


 A minimum of 20 intentionally prepared, completed transactions (incident tickets) for demonstration purposes.


 A distinct separation between active incident records and archived records.


 Clean removal of all unnecessary dummy or development data before final deploymentpresentation.




 Should-have Search and filtering functionality on the admin dashboard to easily navigate the minimum 20 transactions.
 Nice-to-have Automated timestamp tracking for when a ticket changes status from Pending to Resolved to measure response times.
 Success criteria for must-haves
 An admin can successfully archive a resolved ticket, demonstrating that it instantly disappears from the main active view and appears in the archive view.


 The core module successfully tracks a single ticket from request through processing and completion without data loss.





### 5. Users

 Target Client A sample local government unit, such as Barangay Tambo, Parañaque. Note that permission or actual partnership with this client is not required.


 Primary users Barangay OfficialsSecretaries (Admins) and Barangay Residents (Users).
 Secondary users Barangay Tanods (Watchmen) or maintenance crew who act on the dispatched tickets, though they may not log into the system directly.
 Who should not use it Non-residents, police, or fire departments.
 User Roles & Access
 Role  Capabilities  Needs  Main Pain Point 
 ---  ---  ---  --- 
 Admin  View all users, manage profiles, view all active tickets, change ticket statuses, archive records, restore records.  A clear dashboard highlighting pending vs. resolved issues.  Losing track of verbal complaints and facing resident anger over unresolved issues. 
 Resident  Register, log in, submit incident tickets, view own ticket history, update own profile.  A simple submission form and clear visibility of their ticket's current status.  Feeling ignored by the local government after reporting an issue manually. 



### 6. Benefits

 Admin Reduces walk-in traffic at the barangay hall. Provides a clear, organized audit trail of completed work that can be used for end-of-year performance reporting. Eliminates lost paperwork.
 Resident Saves the time and transportation cost of physically visiting the hall. Increases trust through process transparency.
 Measurable outcomes Reduction in the average time it takes to resolve a reported hazard (e.g., dropping from an average of 7 days to 3 days due to better tracking).

### 7. Necessity and usefulness

 Necessary, or just nice to have For the scope of demonstrating a complete, real-world business workflow—from creation to processing, completion, and archiving—this system is strictly necessary. It fulfills all required academic constraints without bloating the scope.


 Usefulness
 Admin (High) Transforms chaotic, undocumented citizen complaints into a manageable, prioritized queue.
 Resident (Medium) Useful only when an issue arises, but highly effective at reducing frustration when it does.


 What happens if it is never built The target client continues relying on inefficient manual logbooks. The demonstration lacks a core business process module, failing the fundamental system integration requirements.


 Honest verdict Build as is. The scope is tightly controlled. By explicitly ignoring complex modules like financial ledgers or inventory management, the system strictly satisfies the account management, user management, core business process, and archive requirements.



### 8. Risks and unknowns

 Assumptions made Assumes the target client's residents have sufficient digital literacy and internet access to submit tickets online. Assumes the barangay has at least one dedicated staff member to monitor the admin dashboard daily.
 Non-technical risks
 Misuse Residents submitting spam, fake reports, or using the system to harass neighbors.
 Adoption Older residents may refuse the digital system and continue demanding in-person service.
 Maintenance If the designated admin goes on leave, the ticketing queue may stagnate, causing resident frustration.


 Open questions How will the system handle duplicate reports (e.g., five different residents logging in to report the exact same broken streetlight)

### Deferred technical questions

 How will image uploads (evidence of the hazard) be stored and served within the constraints of the chosen development stack

---

Summary
This concept maps a highly scoped, functional incident ticketing system designed to fulfill strict workflow and archiving requirements. It replaces inefficient manual complaint tracking for a sample local government client with a digital queue, ensuring residents can report issues and admins can process them to completion. The plan is lean, intentionally avoiding feature bloat to ensure a flawless demonstration of the required 10 users and 20 transactions.

Decisions required before technical planning starts

1. Determine the exact name of the sample Target Client (e.g., a specific barangay) to contextualize the UI and data.


2. Define the exact incident categories (e.g., Sanitation, Infrastructure, Security) that will be hardcoded into the submission form.
3. Decide on the exact data fields required for an incident report (e.g., Title, Description, Category, Status).
4. Establish the protocol for handling duplicate incident reports from multiple users.