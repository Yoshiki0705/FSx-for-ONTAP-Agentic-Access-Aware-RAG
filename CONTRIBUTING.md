# Contributing

Thank you for your interest in contributing to this project.

## How to Contribute

1. **Fork** the repository
2. **Create a branch** from `main` (`git checkout -b feature/your-feature`)
3. **Make changes** following the coding conventions in [AGENTS.md](AGENTS.md)
4. **Run tests** before submitting:
   ```bash
   npx tsc --noEmit
   npx jest --no-coverage
   cd tests/permission-matrix && python3 -m pytest -v
   ```
5. **Submit a Pull Request** with a clear description

## Development Setup

```bash
git clone https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG.git
cd FSx-for-ONTAP-Agentic-Access-Aware-RAG
npm install
```

## Coding Conventions

- **TypeScript (CDK)**: Use `aws-cdk-lib` v2, prefix resources with `${projectName}-${environment}`
- **Python (Lambda)**: Python 3.12, structured JSON logging, separate pure logic from handler
- **Frontend (Next.js)**: Next.js 15 with App Router, Zustand for state, `next-intl` for i18n

See [AGENTS.md](AGENTS.md) for full details.

## Documentation

- All documentation changes must be reflected in **8 languages** (ja, en, ko, zh-CN, zh-TW, fr, de, es)
- Follow the language selector format defined in `.kiro/steering/` rules
- Do not translate code blocks, commands, file paths, or AWS service names

## Code of Conduct

This project follows the [Amazon Open Source Code of Conduct](https://aws.github.io/code-of-conduct). Please report unacceptable behavior to the repository maintainer.

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
