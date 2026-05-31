# Discovery Entrypoint and Replacement Source Specification

`initial_domain` can be used in two different modes:

1. `Replaceable source domain` — the domain is considered an old mirror and can be replaced in filter files.
2. `Discovery entrypoint` — the domain/URL is used only to discover the current mirror via redirect chain and is not
   replaced in filter files.

## Default Mode

If `initial_domain` is set as a bare domain without path:

```yaml
initial_domain: oldmirror123.sx
```

it is considered a replaceable source domain.

If the check discovers a new mirror:

```text
oldmirror123.sx -> newmirror124.sx
```

replacement is allowed:

```text
oldmirror123.sx -> newmirror124.sx
```

## URL with Path

If `initial_domain` is set as a URL with non-empty path:

```yaml
initial_domain: "https://voe.sx/e/nemg6vqtnrkf"
```

it is automatically considered a discovery entrypoint.

In this mode:

* hostname from `initial_domain` is used only as the starting point for checking;
* script traverses the redirect chain;
* final redirect hostname is recorded in `last_known_mirror`;
* hostname from `initial_domain` is not added to the replacement map;
* filter rules with hostname from `initial_domain` are not changed;
* replacements are performed only from old `last_known_mirror` to new final hostname.

Example:

```text
https://voe.sx/e/nemg6vqtnrkf
  -> https://new_voe_mirror.sx/e/nemg6vqtnrkf
```

Result:

```yaml
last_known_mirror: new_voe_mirror.sx
```

Do not replace:

```text
voe.sx -> new_voe_mirror.sx
```

Replace only if old mirror existed:

```text
previous_voe_mirror.sx -> new_voe_mirror.sx
```

## Bare Domain as Discovery Entrypoint

Sometimes `initial_domain` is set as an ordinary domain without path but is actually a stable gateway/entrypoint domain
that redirects to the current mirror.

Example:

```yaml
initial_domain: patronspor.is
```

If it redirects to:

```text
patronmac86.cfd
```

it's not always correct to replace:

```text
patronspor.is -> patronmac86.cfd
```

because `patronspor.is` might be a stable entry point that should remain in filters.

For such cases, the watcher should explicitly set:

```yaml
initial_domain: patronspor.is
replace_initial_domain: false
```

This means: apply the same logic to bare domain as to URL with path.

In this mode:

* `patronspor.is` is used only to find the current mirror;
* `patronspor.is` is not replaced in filter files;
* found final hostname is recorded in `last_known_mirror`;
* if old `last_known_mirror` existed, only it is replaced.

Example:

```yaml
initial_domain: patronspor.is
replace_initial_domain: false
last_known_mirror: patronmac85.cfd
```

Redirect result:

```text
patronspor.is -> patronmac86.cfd
```

Then:

```yaml
last_known_mirror: patronmac86.cfd
```

Replacement:

```text
patronmac85.cfd -> patronmac86.cfd
```

But NOT:

```text
patronspor.is -> patronmac86.cfd
```

## Replacement Source Selection

Algorithm for selecting source domains for replacement:

```text
if initial_domain is URL with non-root path:
    initial_domain host is discovery-only
    replacement sources = [previous last_known_mirror], if present

else if replace_initial_domain === false:
    initial_domain host is discovery-only
    replacement sources = [previous last_known_mirror], if present

else:
    initial_domain host is replaceable
    replacement sources = [initial_domain host, previous last_known_mirror], deduplicated
```

## Invariants

* Discovery entrypoint must never appear in the replacement map.
* URL with path is always discovery-only, even if hostname looks like ordinary mirror.
* `replace_initial_domain: false` makes bare domain discovery-only.
* If there is no old `last_known_mirror`, discovery-only watcher should update only `watchers.yml` but not change
  filter files.
* If old `last_known_mirror` exists, replacement should execute only from old mirror to new mirror.
* You cannot automatically decide by redirect fact whether bare domain is gateway or old mirror. For this you need
  explicit `replace_initial_domain: false`.
