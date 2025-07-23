---
title: "Lead Software Engineer"
company: "Engineering IT, UMD"
dates: "2022–2025"
location: "College Park, MD"
slug: "engineering-it"
summaryPoints:
  - Managed a dev team of 8 and handled hiring/training.
  - Built a user platform integrated with Canvas Badges.
  - Led frontend/backend development with FastAPI, React, MySQL.
---
## Engineering IT  
**Lead Software Engineer (2024–2025)**  
**Software Development Engineer (2022–2024)**  
_University of Maryland_

### Project: Pinpoint – User Management Platform

Pinpoint is a full-stack web application for managing user access, training validation, and lab tool reservations across UMD engineering labs.

#### 👨‍💻 Key Features:
- **Two-sided Platform:**
  - **Admin Side:** Manage labs, lab admins, machines, machine types, and user permissions.
  - **User Side:**  
    - **Swipe-to-Login:** Users swipe their UID using a magnetic stripe reader. This acts as login and logs both **sign-in and sign-out times** for lab usage tracking.  
    - **Canvas Badges Integration:** Connects swiped UID to university Canvas account via API and verifies badge-based training before granting tool access.  
    - **Training-Gated Access:** Tools are grayed out unless the user has completed the required training modules.  
    - **Tool & Machine Reservation:** Users can search for tools/machines and **reserve** them based on eligibility.

---

### 🔧 Technical Responsibilities

**Software Development Engineer (2022–2024):**
- Developed and maintained backend and frontend features using **React.js** and **Python Flask/FastAPI**.
- **Key Contribution – Machine Categorization Redesign:**
  - Refactored backend logic to dynamically fetch and group machines by category.
  - Built a structured, collapsible UI view that improved user navigation and readability.
- Integrated **Canvas Badges API** for secure access control.
- Authored internal technical documentation and handled support tickets.

**Lead Engineer (2024–2025):**
- Oversaw the entire project lifecycle — from requirements gathering to deployment.
- Translated feature requests from [features.umd.edu](https://features.umd.edu) into detailed technical tickets and delegated them to the dev team based on expertise (frontend/backend).

#### 🧠 Major Features Implemented as Lead:
1. **Custom Sign-In Reasons with Auto Sign-Out:**
   - Users can select a reason (e.g., "Workshop") from a dropdown when swiping in.
   - Based on the reason, users are automatically signed out after a predefined time (e.g., 15 minutes).
   - Reduced session clutter and improved backend efficiency.

2. **End-of-Session User Feedback Survey:**
   - After signing out, users are prompted with a short usability survey.
   - Helped collect actionable insights to improve UI/UX.

3. **Admin Controls for Custom Sign-In Rules:**
   - Admins can configure available sign-in reasons and assign auto-sign-out timers.
   - Required end-to-end planning:
     - **Backend:** Designed new endpoints and logic for reason handling and auto-timeouts.
     - **Frontend:** Implemented dropdown menus, admin config panels, and sign-out logic.
     - **DevOps:** Coordinated testing and deployment with Dockerized builds.

- Built onboarding modules and tutorial videos to train new hires on our stack and workflow.
- Led resume screening, technical interviews, and final hiring decisions.

---

### 🛠️ Tech Stack:
- **Frontend:** React.js  
- **Backend:** Python Flask, FastAPI  
- **Database:** MySQL  
- **DevOps:** Docker  
- **Version Control & CI/CD:** GitLab  
- **Deployment:** Linux environments

---

### 🚀 What I Learned

This project gave me deep, hands-on experience with:

- **End-to-End Software Development:**  
  Full-stack development and deployment across complex system layers.

- **DevOps & Production Readiness:**  
  Containerized app using Docker, deployed in Linux environments, managed via GitLab CI/CD.

- **GitLab Workflow:**  
  Hands-on experience with version control, branching strategy, merge requests, issue tracking, and automated builds.

- **Agile & Scrum Leadership:**  
  Led stand-ups, sprint planning, retrospectives, and delegated tickets in a dynamic Agile workflow.

- **Project Management:**  
  Scoped out multi-phase features and broke them down into frontend/backend tickets with well-defined milestones.

- **API Integration & Auth Systems:**  
  Implemented secure Canvas Badge verification flow for role-based access.

- **Technical Mentorship:**  
  Trained junior devs through custom modules and videos to onboard them into a live production environment.

- **Linux Proficiency:**  
  Comfortable with Linux for hosting, debugging, and deployment.

> _This experience helped me grow into a confident full-stack engineer and a reliable team lead — capable of building, managing, and scaling real-world software used daily by hundreds of students and faculty._
