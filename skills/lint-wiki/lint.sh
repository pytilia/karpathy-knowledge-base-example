#!/usr/bin/env bash
# lint-wiki — deterministic checks for karpathy-knowledge-base-example/docs/
# Outputs a machine-parseable report to stdout. Exit 0 always; severity in the report body.

set -uo pipefail

DOCS="$HOME/karpathy-knowledge-base-example/docs"
ITER="$DOCS/iterations"
ADR="$DOCS/decisions"
TODAY_EPOCH=$(date +%s)
STALE_DAYS=90

declare -i blockers=0
declare -i warnings=0
declare -i infos=0

emit() {
  # emit SEVERITY "rule" "file:line" "detail"
  local sev="$1" rule="$2" loc="$3" detail="$4"
  printf '[%s] %s — %s — %s\n' "$sev" "$rule" "$loc" "$detail"
  case "$sev" in
    BLOCKER) blockers+=1 ;;
    WARNING) warnings+=1 ;;
    INFO)    infos+=1 ;;
  esac
}

# -------- Pass 1: frontmatter completeness --------
echo "## Pass 1: Frontmatter completeness"
doc_required=(name description status topic last_reviewed)
adr_required=(adr status date)

check_frontmatter() {
  local f="$1"
  shift
  local fields=("$@")
  local first_line
  first_line=$(head -1 "$f")
  if [[ "$first_line" != "---" ]]; then
    emit BLOCKER "Frontmatter missing" "$f:1" "no YAML frontmatter at top of file"
    return
  fi
  local block
  block=$(awk 'NR>1 && /^---$/{exit} NR>1{print}' "$f")
  for field in "${fields[@]}"; do
    if ! echo "$block" | grep -q "^${field}:"; then
      emit BLOCKER "Frontmatter incomplete" "$f:1" "missing field '${field}'"
    fi
  done
}

shopt -s nullglob
for f in "$DOCS"/*.md "$DOCS"/integrations/*/*.md; do
  check_frontmatter "$f" "${doc_required[@]}"
done
for f in "$ADR"/*.md; do
  check_frontmatter "$f" "${adr_required[@]}"
done

# -------- Pass 2: staleness (last_reviewed > 90d) --------
echo
echo "## Pass 2: Staleness"
check_stale() {
  local f="$1"
  local lr
  lr=$(awk -F': ' '/^last_reviewed:/ {print $2; exit}' "$f")
  [[ -z "$lr" ]] && return
  local lr_epoch
  if ! lr_epoch=$(date -j -f "%Y-%m-%d" "$lr" +%s 2>/dev/null); then
    if ! lr_epoch=$(date -d "$lr" +%s 2>/dev/null); then
      return
    fi
  fi
  local diff_days=$(( (TODAY_EPOCH - lr_epoch) / 86400 ))
  if (( diff_days > STALE_DAYS )); then
    # Don't flag intentionally-stable references (status: archived or status: superseded)
    local status
    status=$(awk -F': ' '/^status:/ {print $2; exit}' "$f")
    case "$status" in
      archived|superseded*) return ;;
    esac
    emit WARNING "Stale (>${STALE_DAYS}d)" "$f" "last_reviewed=${lr} (${diff_days}d ago)"
  fi
}

# Sort by last_reviewed ascending so oldest stale shows first
for f in "$DOCS"/*.md "$DOCS"/integrations/*/*.md "$ADR"/*.md; do
  check_stale "$f"
done

# -------- Pass 3: orphan pages (not referenced from index.md) --------
echo
echo "## Pass 3: Orphan pages"
INDEX="$DOCS/index.md"
if [[ ! -f "$INDEX" ]]; then
  emit BLOCKER "No index.md" "$DOCS" "index.md missing"
else
  for f in "$DOCS"/*.md "$DOCS"/integrations/*/*.md; do
    [[ -e "$f" ]] || continue
    base=$(basename "$f")
    case "$base" in
      index.md|log.md) continue ;;  # the index itself and the log don't need to link to themselves
    esac
    rel="${f#$DOCS/}"
    if ! grep -qF "$base" "$INDEX" && ! grep -qF "$rel" "$INDEX"; then
      emit WARNING "Orphan page" "$f" "not linked from index.md"
    fi
  done
fi

# -------- Pass 4: broken intra-doc links --------
echo
echo "## Pass 4: Broken intra-doc links"
check_links() {
  local f="$1"
  local dir
  dir=$(dirname "$f")
  # awk pre-pass: emit each non-code-fenced line with its line number, skipping ``` fenced blocks
  awk '
    /^```/ { in_fence = !in_fence; next }
    !in_fence { print NR ":" $0 }
  ' "$f" | grep -E '\[[^]]+\]\([^)]+\)' | while IFS=: read -r lineno rest; do
    # there can be multiple links on one line; iterate
    echo "$rest" | grep -oE '\[[^]]+\]\([^)]+\)' | while read -r match; do
      target=$(echo "$match" | sed -E 's/.*\(([^)]+)\)/\1/')
      [[ "$target" =~ ^https?:// ]] && continue
      [[ "$target" =~ ^# ]] && continue
      # placeholder paths inside angle brackets like <story> are templates; skip
      [[ "$target" =~ \< ]] && continue
      target_path=$(echo "$target" | sed -E 's/[?#].*//')
      [[ -z "$target_path" ]] && continue
      target_path=$(printf '%b' "${target_path//%/\\x}")
      if [[ "$target_path" = /* ]]; then
        full="$target_path"
      else
        full="$dir/$target_path"
      fi
      if [[ ! -e "$full" ]]; then
        emit BLOCKER "Broken link" "$f:$lineno" "target '$target_path' does not exist"
      fi
    done
  done
}

for f in "$DOCS"/*.md "$DOCS"/integrations/*/*.md "$ADR"/*.md; do
  check_links "$f"
done

# -------- Pass 5: supersession integrity --------
echo
echo "## Pass 5: Supersession integrity"
for f in "$DOCS"/*.md "$DOCS"/integrations/*/*.md; do
  sb=$(awk -F': ' '/^superseded_by:/ {print $2; exit}' "$f")
  if [[ -n "$sb" ]]; then
    target="$DOCS/$sb"
    if [[ ! -f "$target" ]]; then
      emit BLOCKER "Supersession target missing" "$f" "superseded_by: $sb (file does not exist)"
      continue
    fi
    # the target's `supersedes` should reference us back
    base=$(basename "$f")
    sup=$(awk -F': ' '/^supersedes:/ {print $2; exit}' "$target")
    if [[ "$sup" != "$base" ]]; then
      emit BLOCKER "Supersession asymmetry" "$f" "claims superseded_by: $sb but $sb has supersedes: '$sup' (expected '$base')"
    fi
  fi
done

# -------- Pass 6: ADR sequence (no gaps) --------
echo
echo "## Pass 6: ADR sequence"
if [[ -d "$ADR" ]]; then
  expected=1
  for f in $(ls "$ADR"/[0-9]*.md 2>/dev/null | sort); do
    base=$(basename "$f")
    num=${base:0:4}
    num_int=$((10#$num))
    if (( num_int != expected )); then
      emit BLOCKER "ADR sequence gap or duplicate" "$f" "found $num, expected $(printf '%04d' "$expected")"
      expected=$((num_int + 1))
    else
      expected=$((expected + 1))
    fi
  done
fi

# -------- Pass 7: log.md format --------
echo
echo "## Pass 7: log.md format"
LOG="$DOCS/log.md"
if [[ -f "$LOG" ]]; then
  allowed_types="decision|iteration|meeting|ingest|incident|process-change|proposal|epic-plan"
  awk '
    /^```/ { in_fence = !in_fence; next }
    !in_fence && /^## \[/ { print NR ":" $0 }
  ' "$LOG" | while IFS=: read -r lineno line; do
    if ! echo "$line" | grep -qE "^## \[20[0-9]{2}-[0-9]{2}-[0-9]{2}\] (${allowed_types}) \| .+"; then
      emit WARNING "log.md format" "$LOG:$lineno" "entry doesn't match '## [YYYY-MM-DD] <type> | <title>': $line"
    fi
  done
fi

# -------- Pass 8: iteration-folder naming --------
echo
echo "## Pass 8: Iteration folder naming"
if [[ -d "$ITER" ]]; then
  for d in "$ITER"/*/; do
    name=$(basename "$d")
    # Reject failure modes explicitly:
    # 1. Starts with a digit and a dot (e.g. "3.3-..."): missing 'story-' prefix → BLOCKER
    # 2. Contains uppercase letters or underscores: not kebab-case → WARNING
    # 3. Otherwise: accept (covers story-<x>.<y>-<rest> with arbitrary version dots in the tail, and bare kebab-case for non-stories)
    if [[ "$name" =~ ^[0-9]+\. ]]; then
      emit BLOCKER "Iteration folder missing 'story-' prefix" "$d" "starts with a numeric story ID; rename to 'story-$name'"
    elif [[ "$name" =~ [A-Z_] ]]; then
      emit WARNING "Iteration folder not kebab-case" "$d" "contains uppercase letters or underscores; convert to lowercase-with-hyphens"
    elif [[ "$name" =~ ^story- ]] && ! [[ "$name" =~ ^story-[0-9]+\.[0-9]+ ]]; then
      emit WARNING "Iteration folder 'story-' prefix without story ID" "$d" "uses 'story-' prefix but no <epic>.<story> follows; either add the ID or drop the prefix"
    fi
  done
fi

# -------- Summary --------
echo
echo "## Summary"
top_count=$(ls "$DOCS"/*.md 2>/dev/null | wc -l | tr -d ' ')
nested_count=$(ls "$DOCS"/integrations/*/*.md 2>/dev/null | wc -l | tr -d ' ')
adr_count=$(ls "$ADR"/*.md 2>/dev/null | wc -l | tr -d ' ')
iter_count=$(ls -d "$ITER"/*/ 2>/dev/null | wc -l | tr -d ' ')
echo "Docs scanned: ${top_count} top-level, ${nested_count} integration distillations, ${adr_count} ADRs, ${iter_count} iteration folders"
echo "BLOCKER=${blockers} WARNING=${warnings} INFO=${infos}"
