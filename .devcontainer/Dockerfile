FROM mcr.microsoft.com/devcontainers/base:debian

# Deno のインストール
ENV DENO_INSTALL=/deno
RUN mkdir -p /deno \
    && curl -fsSL https://deno.land/install.sh | sh \
    && chown -R vscode /deno

ENV PATH=${DENO_INSTALL}/bin:${PATH}

# 作業ディレクトリ
WORKDIR /workspace
