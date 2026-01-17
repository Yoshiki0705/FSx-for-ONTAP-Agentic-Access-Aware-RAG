# 🤝 Contributing to FSx for NetApp ONTAP Embedding Batch Workload

Thank you for your interest in contributing to this project! We welcome contributions from the community and are pleased to have you join us.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Guidelines](#contributing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)
- [Documentation](#documentation)
- [Testing](#testing)
- [Code Style](#code-style)
- [Community](#community)

## 📜 Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18.x or higher
- **npm** or **yarn**
- **AWS CLI** 2.x configured with appropriate credentials
- **Git** for version control
- **TypeScript** 4.x or higher
- **jq** for JSON processing

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/embedding-batch-workload.git
cd embedding-batch-workload
```

3. Add the upstream repository:

```bash
git remote add upstream https://github.com/original-org/embedding-batch-workload.git
```

## 🛠️ Development Setup

### CDK Development Environment

```bash
# Navigate to CDK directory
cd cdk

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix
```

### CloudFormation Development

```bash
# Validate CloudFormation templates
./scripts/validate-cloudformation.sh --all --lint --security

# Generate CloudFormation templates from CDK
npx cdk synth --output ./cloudformation-templates/
```

### Environment Setup

```bash
# Copy example configuration
cp examples/basic-config.json config/dev.json

# Edit configuration for your environment
vim config/dev.json

# Run prerequisite checks
./scripts/check-prerequisites.sh
```

## 📝 Contributing Guidelines

### Types of Contributions

We welcome several types of contributions:

- 🐛 **Bug fixes**
- ✨ **New features**
- 📚 **Documentation improvements**
- 🧪 **Tests**
- 🎨 **Code style improvements**
- 🔧 **Infrastructure improvements**
- 🌍 **Localization**

### Before You Start

1. **Check existing issues** to see if your contribution is already being worked on
2. **Create an issue** to discuss major changes before implementing them
3. **Follow the coding standards** outlined in this document
4. **Write tests** for new functionality
5. **Update documentation** as needed

### Branch Naming Convention

Use descriptive branch names that follow this pattern:

- `feature/description-of-feature`
- `bugfix/description-of-bug`
- `docs/description-of-docs-change`
- `refactor/description-of-refactor`
- `test/description-of-test-change`

Examples:
- `feature/add-multi-region-support`
- `bugfix/fix-fsx-mount-permissions`
- `docs/update-deployment-guide`

## 🔄 Pull Request Process

### 1. Prepare Your Changes

```bash
# Create a new branch
git checkout -b feature/your-feature-name

# Make your changes
# ... edit files ...

# Add and commit your changes
git add .
git commit -m "feat: add your feature description"
```

### 2. Test Your Changes

```bash
# Run all tests
npm test

# Run integration tests
./scripts/validate.sh --env test

# Validate CloudFormation templates
./scripts/validate-cloudformation.sh --all
```

### 3. Update Documentation

- Update relevant documentation in the `docs/` directory
- Update the README.md if needed
- Add or update code comments
- Update CHANGELOG.md

### 4. Submit Pull Request

1. Push your branch to your fork:
```bash
git push origin feature/your-feature-name
```

2. Create a pull request on GitHub with:
   - **Clear title** describing the change
   - **Detailed description** of what was changed and why
   - **Link to related issues**
   - **Screenshots** if applicable
   - **Testing instructions**

### 5. Pull Request Template

```markdown
## Description
Brief description of the changes made.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Related Issues
Fixes #(issue number)

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Screenshots (if applicable)

## Checklist
- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
```

## 🐛 Issue Guidelines

### Bug Reports

When reporting bugs, please include:

1. **Clear title** describing the issue
2. **Environment details**:
   - Operating system
   - Node.js version
   - AWS CLI version
   - CDK version
3. **Steps to reproduce** the issue
4. **Expected behavior**
5. **Actual behavior**
6. **Error messages** or logs
7. **Configuration files** (sanitized)

### Feature Requests

When requesting features, please include:

1. **Clear title** describing the feature
2. **Problem statement** - what problem does this solve?
3. **Proposed solution** - how should it work?
4. **Alternatives considered**
5. **Additional context** - mockups, examples, etc.

### Issue Labels

We use the following labels to categorize issues:

- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Improvements or additions to documentation
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention is needed
- `question` - Further information is requested
- `wontfix` - This will not be worked on

## 📚 Documentation

### Documentation Standards

- Use clear, concise language
- Include code examples where appropriate
- Provide both English and Japanese versions when possible
- Use proper markdown formatting
- Include diagrams using Mermaid when helpful

### Documentation Structure

```
docs/
├── DEPLOYMENT_SELECTION_GUIDE.md    # Choosing deployment method
├── CDK_DEPLOYMENT_GUIDE.md          # CDK-specific deployment
├── CLOUDFORMATION_DEPLOYMENT_GUIDE.md # CloudFormation deployment
├── CONFIGURATION_GUIDE.md           # Configuration reference
├── TROUBLESHOOTING_GUIDE.md         # Common issues and solutions
├── ARCHITECTURE_GUIDE.md            # System architecture
└── MIGRATION_GUIDE.md               # Migration between methods
```

### Writing Guidelines

1. **Start with an overview** of what the document covers
2. **Use headings** to organize content logically
3. **Include code examples** that are tested and working
4. **Provide context** for why something is done a certain way
5. **Link to related documentation**
6. **Keep it up to date** with code changes

## 🧪 Testing

### Test Categories

1. **Unit Tests** - Test individual functions and components
2. **Integration Tests** - Test component interactions
3. **End-to-End Tests** - Test complete workflows
4. **Infrastructure Tests** - Test CDK constructs and CloudFormation templates

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Writing Tests

#### CDK Unit Tests

```typescript
import { Template } from 'aws-cdk-lib/assertions';
import * as cdk from 'aws-cdk-lib';
import { EmbeddingWorkloadStack } from '../lib/embedding-workload-stack';

describe('EmbeddingWorkloadStack', () => {
  test('creates batch compute environment', () => {
    const app = new cdk.App();
    const stack = new EmbeddingWorkloadStack(app, 'TestStack', {
      projectName: 'test',
      environment: 'test'
    });
    
    const template = Template.fromStack(stack);
    
    template.hasResourceProperties('AWS::Batch::ComputeEnvironment', {
      Type: 'MANAGED',
      State: 'ENABLED'
    });
  });
});
```

#### Integration Tests

```bash
#!/bin/bash
# Integration test example

set -euo pipefail

echo "Running integration tests..."

# Deploy test stack
./scripts/unified-deploy.sh --method cdk --env test --dry-run

# Validate deployment
./scripts/validate.sh --env test

echo "Integration tests completed successfully"
```

## 🎨 Code Style

### TypeScript Style

We use ESLint and Prettier for code formatting:

```bash
# Check code style
npm run lint

# Fix code style issues
npm run lint:fix

# Format code
npm run format
```

### Configuration Files

- Use **2 spaces** for indentation
- Use **camelCase** for variables and functions
- Use **PascalCase** for classes and interfaces
- Use **UPPER_SNAKE_CASE** for constants

### Shell Scripts

- Use `#!/bin/bash` shebang
- Use `set -euo pipefail` for error handling
- Use meaningful variable names
- Add comments for complex logic
- Use ShellCheck for validation

### CloudFormation/YAML

- Use **2 spaces** for indentation
- Use descriptive resource names
- Add comments for complex configurations
- Use parameters for configurable values

## 🌍 Community

### Communication Channels

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - General questions and discussions
- **Pull Requests** - Code contributions and reviews

### Getting Help

1. **Check the documentation** first
2. **Search existing issues** for similar problems
3. **Create a new issue** with detailed information
4. **Join discussions** to help others

### Recognition

Contributors will be recognized in:

- **README.md** contributors section
- **CHANGELOG.md** for significant contributions
- **GitHub releases** notes

## 📊 Metrics and Analytics

We track the following metrics to improve the project:

- **Issue resolution time**
- **Pull request review time**
- **Test coverage**
- **Documentation completeness**
- **Community engagement**

## 🎯 Roadmap

Check our [project roadmap](https://github.com/your-org/embedding-batch-workload/projects) to see:

- **Planned features**
- **Current priorities**
- **Long-term goals**
- **Community requests**

## 🙏 Thank You

Thank you for contributing to this project! Your efforts help make this tool better for everyone in the community.

---

## 📞 Contact

If you have questions about contributing, please:

1. Check this contributing guide
2. Search existing issues and discussions
3. Create a new issue with the `question` label
4. Reach out to maintainers via GitHub

**Happy Contributing!** 🎉