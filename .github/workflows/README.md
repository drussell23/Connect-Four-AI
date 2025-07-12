# 🚀 GitHub Actions Workflow System

This document explains the comprehensive GitHub Actions workflow system for the Connect4 AI project. The system includes multiple specialized workflows that work together to provide continuous integration, security analysis, performance testing, ML training, and deployment automation.

## 🔗 Workflow Overview

The workflow system consists of 6 main workflows that work together in a coordinated pipeline:

### 1. 🚀 Main Pipeline (`main.yml`)
**The orchestrator that coordinates all other workflows**

- **Triggers**: Push to main/develop, PRs, scheduled runs, manual dispatch
- **Purpose**: Intelligent orchestration of all other workflows based on context
- **Key Features**:
  - Smart pipeline configuration based on branch and event type
  - Conditional execution of different workflow components
  - Failure detection and notification system
  - Comprehensive pipeline reporting

### 2. 🏗️ CI Pipeline (`ci.yml`)
**Continuous Integration with multi-environment testing**

- **Triggers**: Called by main pipeline or runs independently
- **Purpose**: Build, test, and validate all code components
- **Key Features**:
  - Path-based filtering (only runs for changed components)
  - Matrix builds (Node.js 18/20, Python 3.9/3.10/3.11)
  - Backend (NestJS), Frontend (React), ML Service (Python), C++ support
  - Integration testing with PostgreSQL
  - Comprehensive caching strategies

### 3. 🔒 Security Analysis (`security.yml`)
**Comprehensive security scanning and vulnerability detection**

- **Triggers**: Called by main pipeline or runs independently
- **Purpose**: Multi-layered security analysis
- **Key Features**:
  - Dependency vulnerability scanning (npm audit, Snyk, OWASP, Safety)
  - Static code analysis (ESLint, CodeQL, Bandit, Semgrep)
  - Container security scanning (Trivy, Grype, Docker Scout)
  - Secrets detection (GitLeaks, TruffleHog, detect-secrets)
  - Automated security reporting and alerting

### 4. 📊 Performance Analysis (`performance.yml`)
**AI algorithm benchmarking and performance testing**

- **Triggers**: Called by main pipeline or runs independently
- **Purpose**: Performance benchmarking and regression detection
- **Key Features**:
  - AI algorithm benchmarking (Minimax, MCTS, AlphaZero)
  - ML inference performance testing (PyTorch vs ONNX)
  - System performance monitoring
  - Load testing with Artillery
  - Performance regression detection

### 5. 🤖 ML Training (`ml_training.yml`)
**Machine learning model training and evaluation**

- **Triggers**: Called by main pipeline or runs independently
- **Purpose**: Automated ML model training and versioning
- **Key Features**:
  - Multiple training types (incremental, full, hyperparameter tuning)
  - Model architecture selection (policy_net, value_net, alphazero)
  - MLflow integration for experiment tracking
  - Model evaluation and benchmarking
  - Automatic ONNX export for production

### 6. 🚀 Deployment Pipeline (`deployment.yml`)
**Multi-environment deployment automation**

- **Triggers**: Called by main pipeline or runs independently
- **Purpose**: Automated deployment to staging/production
- **Key Features**:
  - Docker containerization with multi-stage builds
  - Container registry publishing
  - Kubernetes manifest generation
  - Smoke testing post-deployment
  - Release management with comprehensive release notes

## 🎯 Execution Flow

### For Pull Requests:
```
PR Created → Main Pipeline → CI Pipeline → Security Analysis (quick scan)
                                      ↓
                                   Results posted as PR comment
```

### For Main Branch Push:
```
Push to main → Main Pipeline → CI Pipeline → Security Analysis (full scan)
                                      ↓              ↓
                              ML Training Pipeline   Performance Tests
                                      ↓              ↓
                                   Deployment Pipeline (staging)
                                      ↓
                              Post-Deployment Validation
                                      ↓
                                 Release Creation
```

### For Scheduled Runs (Weekly):
```
Schedule → Main Pipeline → All Workflows (comprehensive analysis)
                     ↓
                Full security audit, performance benchmarking, ML training
                     ↓
                Deployment to staging environment
```

## 🔧 Configuration & Customization

### Manual Workflow Dispatch Options:

The main pipeline supports several manual configuration options:

- **`run_full_suite`**: Execute complete pipeline including training and deployment
- **`environment`**: Target environment (staging/production)
- **`skip_tests`**: Skip test execution for faster runs
- **`run_security_scan`**: Enable/disable security analysis
- **`run_performance_tests`**: Enable/disable performance benchmarks

### Environment Variables:

Key environment variables used across workflows:

```yaml
NODE_VERSION: '18'           # Node.js version for builds
PYTHON_VERSION: '3.9'       # Python version for ML components
CACHE_VERSION: 'v1'         # Cache versioning for invalidation
```

### Secrets Configuration:

Optional secrets for enhanced functionality:

```yaml
# Security Analysis
SNYK_TOKEN: 'your-snyk-token'                    # Snyk vulnerability scanning
DOCKER_SCOUT_TOKEN: 'your-docker-scout-token'   # Docker Scout container scanning
GITLEAKS_LICENSE: 'your-gitleaks-license'       # GitLeaks Pro features
SLACK_WEBHOOK_URL: 'your-slack-webhook'         # Slack notifications

# ML Training
MLFLOW_TRACKING_URI: 'your-mlflow-server'       # MLflow tracking server
WANDB_API_KEY: 'your-wandb-key'                 # Weights & Biases integration

# Deployment
DOCKER_USERNAME: 'your-docker-username'         # Docker registry auth
DOCKER_PASSWORD: 'your-docker-password'         # Docker registry auth
```

## 📊 Monitoring & Reporting

### Pipeline Summaries:
Each workflow generates comprehensive GitHub Step Summaries with:
- Execution status and duration
- Configuration details
- Links to related resources
- Performance metrics and trends

### Failure Handling:
- Automatic issue creation for pipeline failures
- Detailed failure reports with links to logs
- Slack notifications for critical issues
- Smart retry logic with exponential backoff

### Security Reporting:
- Vulnerability assessment reports
- SARIF uploads to GitHub Security tab
- Automated security issue creation
- Compliance and audit trail

## 🚀 Getting Started

### 1. Basic Setup:
```bash
# Ensure all required files are in place
ls -la .github/workflows/
# Should show: main.yml, ci.yml, security.yml, performance.yml, ml_training.yml, deployment.yml

# Check CodeQL configuration
ls -la .github/codeql/
# Should show: codeql-config.yml
```

### 2. First Run:
```bash
# Push to main branch to trigger full pipeline
git push origin main

# Or manually trigger with options
# Go to: Actions → Main Pipeline → Run workflow
```

### 3. Monitoring:
```bash
# View pipeline status
# Go to: Actions → Main Pipeline → Latest run

# Check security findings
# Go to: Security → Security overview

# Monitor performance trends
# Go to: Actions → Performance Analysis
```

## 🔄 Workflow Dependencies

### Artifact Sharing:
Workflows share data through GitHub Actions artifacts:

- **CI Pipeline** → **Security Analysis**: Built containers for scanning
- **CI Pipeline** → **Performance Tests**: Compiled binaries for benchmarking
- **ML Training** → **Deployment**: Trained models for deployment
- **All Workflows** → **Main Pipeline**: Status and results for orchestration

### Conditional Execution:
Smart conditional logic ensures efficient resource usage:

```yaml
# Only run security on main branch pushes or manual triggers
if: github.ref == 'refs/heads/main' || github.event_name == 'workflow_dispatch'

# Only run ML training on successful CI
if: needs.ci-pipeline.result == 'success'

# Only deploy if all prerequisites pass
if: needs.ci-pipeline.result == 'success' && needs.security-pipeline.result == 'success'
```

## 🛠️ Troubleshooting

### Common Issues:

1. **Secret Access Warnings**: These are expected for optional external services
2. **Cache Misses**: Increase `CACHE_VERSION` to invalidate caches
3. **ML Training Failures**: Check Python dependencies and model files
4. **Deployment Issues**: Verify Docker registry credentials and environment config

### Debug Tips:

1. **Enable Debug Logging**:
   ```yaml
   env:
     ACTIONS_STEP_DEBUG: true
   ```

2. **Check Workflow Syntax**:
   ```bash
   # Use GitHub CLI to validate
   gh workflow view main.yml
   ```

3. **Monitor Resource Usage**:
   ```bash
   # Check runner capacity and timing
   # Actions → Usage → View usage details
   ```

## 📈 Performance Optimization

### Caching Strategy:
- **Node.js**: npm cache with lockfile hashing
- **Python**: pip cache with requirements hashing
- **Docker**: Multi-stage builds with layer caching
- **Artifacts**: Selective artifact retention (7-90 days)

### Parallel Execution:
- Matrix builds for multiple environments
- Parallel workflow execution where possible
- Selective component execution based on file changes

### Resource Management:
- Appropriate runner selection (ubuntu-latest, gpu-runner when needed)
- Efficient resource allocation in containers
- Smart timeout configurations

## 🔒 Security Best Practices

### Secret Management:
- Use GitHub Secrets for sensitive data
- Implement least-privilege access
- Regular secret rotation
- Audit secret usage

### Container Security:
- Multi-stage builds to minimize attack surface
- Regular base image updates
- Comprehensive vulnerability scanning
- SARIF integration with GitHub Security

### Code Security:
- Static analysis with multiple tools
- Dependency vulnerability scanning
- Secrets detection in code
- Automated security issue creation

## 🎉 Contributing

### Adding New Workflows:
1. Create workflow in `.github/workflows/`
2. Add integration to `main.yml`
3. Update this README
4. Test thoroughly before merging

### Workflow Modifications:
1. Follow existing patterns and conventions
2. Maintain backward compatibility
3. Add appropriate error handling
4. Update documentation

### Testing Workflows:
1. Use `act` for local testing
2. Test in feature branches
3. Validate with various trigger conditions
4. Monitor resource usage

---

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax Reference](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions)
- [Docker Actions](https://docs.github.com/en/actions/creating-actions/creating-a-docker-container-action)
- [Security Best Practices](https://docs.github.com/en/actions/security-guides)

---

*This workflow system is designed to be robust, scalable, and maintainable. It provides comprehensive automation for the entire development lifecycle while maintaining security and performance standards.* 