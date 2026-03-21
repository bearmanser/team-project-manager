# Team Project Manager

**Team Project Manager** is a project management and bug-tracking software built for software development teams and agile workflows. It brings planning, collaboration, and development tracking together in one place, making it easier to manage work from idea to deployment.

👉 **Live version:** [https://www.grinderstudio.no/team-project-manager](https://www.grinderstudio.no/team-project-manager)

---

## Overview

This application is designed to help teams organize their work in a structured and practical way. It combines task management, bug tracking, sprint planning, and GitHub integration into a single platform.

Whether you're working in sprints or using a continuous workflow, the system adapts to how your team prefers to operate.

At its core, this is a tool built around how software teams actually work day-to-day, not just a generic task manager.

---

## Key Features

* Create and manage organizations and projects
* Track tasks and bug reports in a structured workflow
* Plan and manage sprints or use a continuous delivery approach
* Assign work with role-based permissions
* Collaborate through comments and mentions
* Receive notifications for updates and assignments
* Connect GitHub accounts and repositories
* Link GitHub issues directly to tasks
* Create branches from within tasks

---

## Frontend

The frontend is located in [`Frontend`](./Frontend) and is what users interact with in the browser.

**Built with:**

* React 19
* TypeScript
* Vite
* Chakra UI

**Responsibilities:**

* Authentication (login and signup)
* Navigation between organizations and projects
* Task boards, sprint views, and bug tracking interfaces
* Creating and editing work items through modals
* Notifications and theme handling

The frontend acts as the presentation layer, communicating with the backend through API requests and updating the UI based on the current project state.

---

## Backend

The backend is located in [`Backend`](./Backend) and handles all core logic, data management, and integrations.

**Built with:**

* Django 6
* Python 3.13
* SQLite
* Gunicorn
* Docker

**Responsibilities:**

* Authentication and authorization
* Data handling for projects, tasks, and organizations
* Sprint management
* Comments, activity tracking, and notifications
* GitHub integration (OAuth, repositories, issues, branches)

---

## Core Concepts

The system is structured around a few main entities:

* **Organization** – A workspace containing multiple projects
* **Project** – The main working area for a team
* **Task** – Planned or ongoing work
* **Bug Report** – Issues or defects that need fixing
* **Sprint** – Optional time-based work cycles
* **Project Membership** – Roles and permissions
* **Notification & Activity** – Collaboration and updates

---

## Architecture

The application follows a clean client-server architecture:

1. The frontend handles the user interface and interactions
2. The backend processes requests, applies business logic, and manages data
3. Data is exchanged through JSON APIs

**How it works in practice:**

* Users authenticate and receive a token
* The frontend uses that token to access protected endpoints
* The backend validates permissions before processing requests
* Updated data is returned and rendered in the UI

There is also a lightweight event system that allows the frontend to detect updates without requiring a full page reload, which is pretty fucking nice for responsiveness.

---

## Technology Highlights

* Full-stack web development with React and Django
* Strong use of TypeScript for type safety
* REST API design with structured domain modeling
* JWT-based authentication
* GitHub OAuth and repository integration
* Role-based access control
* Support for agile workflows (sprints and backlog)
* Docker-based backend setup
* Frontend optimized for modern deployment platforms

---

## Repository Structure

```text
team-project-manager/
|- Backend/    Django API, models, auth, GitHub integration, database setup
|- Frontend/   React app, pages, components, API client, theme system
|- example-image.png
```

---

## Summary

Team Project Manager is a full-stack application that demonstrates how modern project management tools can be built specifically for software teams. It combines planning, tracking, and development workflows into a cohesive system, making it useful both as a real tool and as a technical project showcasing end-to-end development.
