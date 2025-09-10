# padh.ai - AI-Powered Teaching Platform

[![Live Demo](https://img.shields.io/badge/Live%20Demo-View%20Now-green)](https://samvaad-ai-gamma.vercel.app/sign-in)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.0-38B2AC)](https://tailwindcss.com/)

Samvaad is a modern, AI-powered communication and collaboration platform designed to streamline meetings, agent management, and team productivity. Built with Next.js 14, TypeScript, and a focus on user experience.
 

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
