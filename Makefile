# 検査の単一入口。
#
# CI が実行するものと同じコマンドを、同じ名前で手元から呼べるようにする。
# 検査の定義を 2 か所に書くと片方だけが更新されるため、synth のフラグは
# .github/workflows/ci-cd.yml の matrix から実行時に読む。
#
# .PHONY を宣言していないターゲットは、同名のファイル / ディレクトリが
# 存在すると「up to date」を返して**一度も実行されない**。
# 過去にこれで検出器が走っていなかったことがあるため、全ターゲットを宣言する。

.PHONY: help all lint test test-frontend test-python docs evidence deps secrets actions \
        synth synth-default build clean

WORKFLOW := .github/workflows/ci-cd.yml

help: ## 使えるターゲットを表示する
	@echo "検査の単一入口 — make <target>"
	@echo
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'
	@echo
	@echo "all は速い検査だけを走らせます（synth と E2E は含みません）。"

all: lint test docs evidence deps ## 速い検査をまとめて走らせる（lint / test / docs / evidence / deps）

lint: ## TypeScript の型検査（npx tsc --noEmit）
	npx tsc --noEmit

# Node の版は .nvmrc（22）に合わせる。CI も 22 で実行している。
# **[hypothesis]** 手元の Node 26.4.0 では aws-sdk-client-mock を使う 7 suite のうち
# 6 suite（26 テスト）が落ちる。CI（Node 22）では 751 件すべて通るため版差を疑っているが、
# Node 22 を手元に用意して比較していないので原因は**未検証**。
test: ## CDK / Lambda の Jest テスト（Node は .nvmrc の 22 を使う）
	npx jest --no-coverage --forceExit

test-frontend: ## フロントエンドの Vitest（既知の flaky あり: 単独実行では通るテストが全体実行で落ちる）
	cd docker/nextjs && npx vitest run

test-python: ## Python Lambda の pytest（3 ディレクトリ）
	cd automation/transfer-family && python3 -m pytest tests/ -q
	cd automation/fsxn-ops && python3 -m pytest tests/ -q
	cd lambda/kb-auto-sync && python3 -m pytest tests/ -q

# 検出器は本検査の前に --selftest を通す。
# 「ゲートが成功した」ことは「ゲートが走った」ことの証拠ではないため、
# 落とすべき入力で落ちることを毎回確認する。
docs: ## ドキュメントの相対リンク検査
	python3 scripts/check-doc-links.py --selftest
	python3 scripts/check-doc-links.py

evidence: ## 証跡ラベルの検査（docs/evidence-policy.md）
	python3 scripts/check-evidence.py --selftest
	python3 scripts/check-evidence.py

deps: ## 依存関係の脆弱性を重大度方針で検査
	python3 scripts/check-dependency-audit.py --selftest
	python3 scripts/check-dependency-audit.py

secrets: ## シークレット検出（gitleaks）
	gitleaks detect --config .gitleaks.toml --no-git --source .

actions: ## GitHub Actions のセキュリティリント（zizmor）
	zizmor .github/workflows/

synth-default: ## 既定フラグでの cdk synth
	npx cdk synth --quiet

synth: ## CI と同じ 10 レーンの cdk synth（フラグは ci-cd.yml の matrix から読む）
	@python3 -c "import yaml" 2>/dev/null || \
		{ echo "PyYAML が必要です: pip3 install pyyaml"; exit 1; }
	@python3 -c "import yaml, subprocess, sys, shlex; \
lanes = yaml.safe_load(open('$(WORKFLOW)'))['jobs']['synth-matrix']['strategy']['matrix']['include']; \
print(f'{len(lanes)} レーンを検査します'); \
[ (print(f'--- {l[\"name\"]} ---'), \
   sys.exit(f'synth が失敗しました: {l[\"name\"]}') if subprocess.run( \
       ['npx','cdk','synth','--quiet'] + shlex.split(l.get('flags') or '')).returncode else None) \
  for l in lanes ]; \
print('全レーン成功')"

build: ## TypeScript のコンパイル
	npx tsc

clean: ## 生成物を削除する（cdk.out と tsc の出力）
	rm -rf cdk.out
	find lib bin tests -name '*.js' -o -name '*.d.ts' | xargs rm -f 2>/dev/null || true
