# Proctoring App Backend

## Table of Contents
- [Introduction](#introduction)
- [Installation](#installation)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
  - [User Routes](#user-routes)
  - [Organisation Routes](#organisation-routes)
  - [Exam Routes](#exam-routes)
  - [Proctoring Routes](#proctoring-routes)
- [Schemas](#schemas)
  - [User Schema](#user-schema)
  - [Organisation Schema](#organisation-schema)
  - [Exam Schema](#exam-schema)
  - [Proctoring Session Schema](#proctoring-session-schema)
- [Testing](#testing)
- [Environment Variables](#environment-variables)
- [License](#license)
- [Workflow Guide](#workflow-guide)

## Introduction
This is the backend for the Proctoring App, which manages users, exams, and proctoring sessions. It is built using Node.js, Express, and TypeScript, with Prisma as the ORM and Zod for schema validation.

## Installation
1. Clone the repository:
    ```sh
    git clone https://github.com/yourusername/proctoring-app-backend.git
    ```
2. Navigate to the project directory:
    ```sh
    cd proctoring-app-backend
    ```
3. Install dependencies:
    ```sh
    npm install
    ```
4. Set up the database:
    ```sh
    npm run migrate
    ```

## Usage
1. Start the development server:
    ```sh
    npm run dev
    ```
2. Build the project:
    ```sh
    npm run build
    ```
3. Start the production server:
    ```sh
    npm start
    ```

## Project Structure
```txt
.
├── package.json
├── package-lock.json
├── prisma
│   ├── migrations
│   │   ├── 20250102012215_init
│   │   │   └── migration.sql
│   │   ├── 20250102104616_init
│   │   │   └── migration.sql
│   │   ├── 20250102104943_init
│   │   │   └── migration.sql
│   │   ├── 20250102111739_init
│   │   │   └── migration.sql
│   │   ├── 20250102113050_init
│   │   │   └── migration.sql
│   │   ├── 20250102145210_add_tab_change_and_heartbeat_logs
│   │   │   └── migration.sql
│   │   ├── 20250103204652_add_chat_message_model
│   │   │   └── migration.sql
│   │   ├── 20250103221011_updated_enums_and_roles
│   │   │   └── migration.sql
│   │   ├── 20250104022816_
│   │   │   └── migration.sql
│   │   └── migration_lock.toml
│   └── schema.prisma
├── README.md
├── src
│   ├── auth
│   │   └── Auth.ts
│   ├── config
│   │   └── jwt.ts
│   ├── constants
│   │   └── user.constants.ts
│   ├── controllers
│   │   ├── auth.controller.ts
│   │   ├── exam.controller.ts
│   │   ├── organisation.controller.ts
│   │   ├── proctor.controller.ts
│   │   └── user.controller.ts
│   ├── middleware
│   │   └── auth.ts
│   ├── modules
│   │   ├── auth
│   │   │   └── auth.service.ts
│   │   ├── exams
│   │   │   └── exam.service.ts
│   │   ├── organisation
│   │   │   └── organisation.service.ts
│   │   ├── proctoring
│   │   │   └── proctor.service.ts
│   │   └── users
│   │       └── user.service.ts
│   ├── routes
│   │   ├── auth.routes.ts
│   │   ├── exam.routes.ts
│   │   ├── organisation.routes.ts
│   │   ├── proctor.routes.ts
│   │   └── user.routes.ts
│   ├── server.ts
│   ├── types
│   │   └── express
│   │       └── index.d.ts
│   ├── utils
│   │   ├── errorResponse.ts
│   │   └── passwordHash.ts
│   └── websockets
│       └── websocket.ts
├── tree.txt
└── tsconfig.json

29 directories, 40 files
```

## API Endpoints

### User Routes
- `POST /routes/users` - Create a new user
- `GET /routes/users` - Get all users
- `GET /routes/users/:id` - Get a user by ID
- `PUT /routes/users/:id` - Update a user
- `DELETE /routes/users/:id` - Delete a user

### Organisation Routes
- `POST /routes/organisations` - Create a new organisation
- `GET /routes/organisations` - Get all organisations
- `GET /routes/organisations/:id` - Get an organisation by ID
- `PUT /routes/organisations/:id` - Update an organisation
- `DELETE /routes/organisations/:id` - Delete an organisation

### Exam Routes
- `POST /routes/exams` - Create a new exam
- `GET /routes/exams` - Get all exams
- `GET /routes/exams/:id` - Get an exam by ID
- `PUT /routes/exams/:id` - Update an exam
- `DELETE /routes/exams/:id` - Delete an exam

### Proctoring Routes
- `POST /routes/proctoring/start` - Start a proctoring session
- `PUT /routes/proctoring/end/:sessionId` - End a proctoring session
- `GET /routes/proctoring/:sessionId` - Get the status of a proctoring session
- `POST /routes/proctoring/tab-change` - Handle tab change event
- `POST /routes/proctoring/heartbeat` - Handle heartbeat event

## Schemas

### User Schema
```ts
export const UserSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
    salt: z.string().min(1),
    role: UserRole.default("STUDENT"),
    organisationId: z.string(),
    organisation: z.any().optional(),
    exams: z.array(z.any()).optional(),
    sessions: z.array(z.any()).optional(),
});
```

### Organisation Schema
```ts
export const OrganisationSchema = z.object({
    name: z.string().min(1),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});
```

### Exam Schema
```ts
export const ExamSchema = z.object({
    id: z.string(),
    title: z.string().min(1),
    duration: z.number().int().positive(),
    organisationId: z.string(),
    organisation: z.any().optional(),
    users: z.array(z.any()).optional(),
});
```

### Proctoring Session Schema
```ts
export const ProctoringSessionSchema = z.object({
    id: z.string(),
    status: z.string().min(1),
    startTime: z.date(),
    endTime: z.date().nullable(),
    examId: z.string(),
    userId: z.string(),
    organisationId: z.string(),
    user: z.any().optional(),
    exam: z.any().optional(),
    organisation: z.any().optional(),
});
```

## Testing
1. Run tests:
    ```sh
    npm test
    ```
2. Test configuration is defined in `jest.config.js`.

## Environment Variables
Create a `.env` file in the root directory and add the following variables:
```env
DATABASE_URL="your-database-url"
JWT_SECRET="your-jwt-secret"
PORT=3000
PBKDF2_ITERATIONS=10000
PBKDF2_KEYLEN=64
PBKDF2_DIGEST=sha512
WS_PORT=4000
```

## License
This project is licensed under the MIT License.

## Workflow Guide

### Step 1: Sales Team Creates an Organisation
The sales team creates an organisation using the following endpoint:
- `POST /routes/organisations`
    ```json
    {
      "name": "New Organisation"
    }
    ```

### Step 2: Sales Team Creates an Admin
The sales team creates an admin for the organisation using the following endpoint:
- `POST /routes/users`
    ```json
    {
      "name": "Admin Name",
      "email": "admin@example.com",
      "password": "password123",
      "role": "ADMIN",
      "organisationId": "organisation-id"
    }
    ```

### Step 3: Admin Adds Proctors to the Organisation
The admin adds proctors to the organisation using the following endpoint:
- `POST /routes/users`
    ```json
    {
      "name": "Proctor Name",
      "email": "proctor@example.com",
      "password": "password123",
      "role": "PROCTOR",
      "organisationId": "organisation-id"
    }
    ```

### Step 4: Users Join the Organisation
Users join the organisation using the following endpoint:
- `POST /routes/users`
    ```json
    {
      "name": "User Name",
      "email": "user@example.com",
      "password": "password123",
      "role": "STUDENT",
      "organisationId": "organisation-id"
    }
    ```

This workflow ensures that the organisation is created first, followed by the creation of an admin, who then adds proctors and users to the organisation.