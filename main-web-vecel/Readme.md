# Main Web Vercel

This folder contains the front-end implementation of the Remote Proctoring System using Next.js and Tailwind CSS. Below are the details for setting up and working with this folder.

## Project Structure

- **app/**: Application-level pages and layouts.
  - `globals.css`: Global CSS styles for the application.
  - `layout.tsx`: Layout configuration for all pages.
  - `(root)/`: Contains main pages like Home, Candidate, and Proctor.

- **components/**: Reusable UI components.
  - `layout/`: Layout-related components like Navbar and Footer.
  - `ui/`: Core UI elements such as Buttons, Forms, and Alerts.

- **public/**: Publicly accessible assets, such as animations or images.

- **tailwind.config.ts**: Configuration for Tailwind CSS.

- **tsconfig.json**: TypeScript configuration for the project.

## Setup Instructions

1. Clone the repository:

   ```bash
   git clone https://github.com/your-repo-url.git
   ```

2. Navigate to the `main-web-vercel` directory:

   ```bash
   cd main-web-vercel
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

## Key Features

- Responsive design with Tailwind CSS.
- Reusable UI components for consistent design.
- Server-side rendering with Next.js for optimized performance.

## Contributing

We welcome contributions to improve this project. Please follow the guidelines in [CONTRIBUTING.md](../CONTRIBUTING.md).

## License

This project is licensed under the MIT License. See the [LICENSE](../LICENSE) file for details.
