# Samvaad - AI-Powered Communication Platform

[![Live Demo](https://img.shields.io/badge/Live%20Demo-View%20Now-green)](https://samvaad-ai-gamma.vercel.app/sign-in)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.0-38B2AC)](https://tailwindcss.com/)

Samvaad is a modern, AI-powered communication and collaboration platform designed to streamline meetings, agent management, and team productivity. Built with Next.js 14, TypeScript, and a focus on user experience.

## ✨ Features

### 🔐 Authentication & Security

- **OAuth Integration**: Sign in with Google and GitHub
- **Secure Session Management**: Robust authentication flow
- **User Privacy**: Built with privacy-first principles

### 📅 Meeting Management

- **Smart Scheduling**: Create and manage meetings effortlessly
- **Real-time Status Tracking**: Monitor meeting states (upcoming, active, completed, cancelled)
- **Transcript Management**: AI-powered meeting transcripts and summaries
- **Agent Assignment**: Assign and manage meeting participants

### 🤖 Agent System

- **AI Agent Management**: Create, configure, and manage AI agents
- **Agent Profiles**: Detailed agent information and capabilities
- **Meeting Integration**: Seamlessly integrate agents into meetings

### 🎥 Video Calling

- **Real-time Communication**: Built-in video calling capabilities
- **Call States**: Lobby, connecting, active, and ended states
- **Responsive Design**: Works across all devices

### 📊 Dashboard & Analytics

- **Comprehensive Dashboard**: Overview of meetings, agents, and activities
- **Data Tables**: Sortable and filterable data views
- **Search & Filter**: Advanced search and filtering capabilities

## 🛠️ Tech Stack

### Frontend

- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **Shadcn/ui**: Modern component library
- **React Hook Form**: Form handling and validation

### Backend & Database

- **tRPC**: End-to-end typesafe APIs
- **Drizzle ORM**: Type-safe database queries
- **PostgreSQL**: Primary database
- **NextAuth.js**: Authentication solution

### Real-time & Communication

- **WebRTC**: Video calling capabilities
- **WebSocket**: Real-time communication
- **Inngest**: Background job processing

### Deployment & Infrastructure

- **Vercel**: Hosting and deployment
- **Polar**: Payment processing
- **GitHub**: Version control and CI/CD

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, pnpm, or bun
- PostgreSQL database

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/samvaad.git
   cd samvaad
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Environment Setup**
   Create a `.env.local` file in the root directory:

   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/samvaad"

   # Authentication
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-secret-key"

   # OAuth Providers
   GOOGLE_CLIENT_ID="your-google-client-id"
   GOOGLE_CLIENT_SECRET="your-google-client-secret"
   GITHUB_CLIENT_ID="your-github-client-id"
   GITHUB_CLIENT_SECRET="your-github-client-secret"

   # Inngest
   INNGEST_EVENT_KEY="your-inngest-key"
   INNGEST_SIGNING_KEY="your-inngest-signing-key"
   ```

4. **Database Setup**

   ```bash
   # Run database migrations
   npm run db:migrate

   # Seed the database (if applicable)
   npm run db:seed
   ```

5. **Start Development Server**

   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
samvaad/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Authentication routes
│   │   ├── (dashboard)/       # Dashboard routes
│   │   ├── api/               # API routes
│   │   └── call/              # Video calling routes
│   ├── components/            # Reusable UI components
│   ├── modules/               # Feature modules
│   │   ├── agents/           # Agent management
│   │   ├── auth/             # Authentication
│   │   ├── call/             # Video calling
│   │   ├── dashboard/        # Dashboard
│   │   ├── meetings/         # Meeting management
│   │   └── premium/          # Premium features
│   ├── db/                   # Database schema and config
│   ├── lib/                  # Utility functions
│   └── trpc/                 # tRPC configuration
├── public/                   # Static assets
└── drizzle.config.ts         # Database configuration
```

## 🚀 Deployment

### Vercel Deployment (Recommended)

1. **Push to GitHub**

   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy on Vercel**
   - Connect your GitHub repository to Vercel
   - Configure environment variables in Vercel dashboard
   - Deploy automatically on push to main branch

### Environment Variables for Production

Make sure to set these environment variables in your Vercel dashboard:

```env
DATABASE_URL="your-production-database-url"
NEXTAUTH_URL="https://your-domain.vercel.app"
NEXTAUTH_SECRET="your-production-secret"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
INNGEST_EVENT_KEY="your-inngest-key"
INNGEST_SIGNING_KEY="your-inngest-signing-key"
```

## 🤝 Contributing

We welcome contributions! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Guidelines

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add some amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) for the amazing React framework
- [Shadcn/ui](https://ui.shadcn.com/) for the beautiful component library
- [Vercel](https://vercel.com/) for seamless deployment
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first CSS framework

## 📞 Support

- **Live Demo**: [https://samvaad-ai-gamma.vercel.app/sign-in](https://samvaad-ai-gamma.vercel.app/sign-in)
- **Issues**: [GitHub Issues](https://github.com/yourusername/samvaad/issues)
- **Email**: your-email@example.com

---

**Built with ❤️ using Next.js, TypeScript, and modern web technologies.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-View%20Now-green)](https://samvaad-ai-gamma.vercel.app/sign-in)
