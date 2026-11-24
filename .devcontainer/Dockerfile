FROM mcr.microsoft.com/devcontainers/base:debian

# Node.js 22（apps/web の Next.js、npm workspaces）
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Deno（apps/api の Ledger API、db/seed-supabase.ts）
ENV DENO_INSTALL=/deno
RUN mkdir -p /deno \
    && curl -fsSL https://deno.land/install.sh | sh \
    && chown -R vscode /deno

ENV PATH=${DENO_INSTALL}/bin:${PATH}

# 作業ディレクトリ
WORKDIR /workspace
