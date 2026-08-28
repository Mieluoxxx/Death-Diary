# Error Handling

## Scope / Trigger

The Hono API is the trust boundary for account credentials, save envelopes,
revision checks, and JSON payload size. Validation must happen before database
writes.

## Signatures

- `createApp(options: AppOptions): DeathDiaryApp`
- `parseCloudSaveEnvelope<T>(value: unknown): CloudSaveEnvelope<T> | null`
- `StorageDatabase.putSave(input): WriteResult<SaveRecord>`

## Contracts

- Known client errors use `{ error: { code, message } }`.
- `ApiError` carries an HTTP status in `400|401|403|404|409|413|422`.
- Unknown errors are logged with `console.error` and returned as
  `internal_error`; credentials, tokens, and save contents are not logged.
- Save writes require `expectedRevision`, `schemaVersion`, `clientBuild`, and
  `state: { session: object }`.
- Revision mismatch returns `409 revision_conflict` with the current record.

## Validation & Error Matrix

| Condition | HTTP / code |
|---|---|
| Invalid JSON or oversized body | `422 invalid_json` / `413 payload_too_large` |
| Unsupported save schema | `422 unsupported_schema_version` |
| Missing/non-object save session | `422 invalid_save` |
| Missing/expired auth cookie | `401 unauthorized` |
| Cross-origin mutating request | `403 origin_forbidden` |
| Stale save revision | `409 revision_conflict` |
| Unexpected exception | `500 internal_error` |

## Good / Base / Bad Cases

- Good: parse and validate the shared save envelope, then call
  `StorageDatabase.putSave` with its revision and hash.
- Base: return a stable API error body for expected client mistakes.
- Bad: cast `body.state` and write it before validating `state.session`.

## Tests Required

- `server/src/app.test.ts` must cover valid save round-trip, malformed save,
  unsupported schema, origin rejection, and stale revision conflict.
- Shared contract tests must cover v1 acceptance and malformed envelopes.

## Wrong vs Correct

### Wrong

```ts
const state = body.state as SaveState;
database.putSave({ stateJson: JSON.stringify(state), ...input });
```

### Correct

```ts
const schemaVersion = parseSchemaVersion(body.schemaVersion);
if (!parseCloudSaveEnvelope({ schemaVersion, state: body.state })) {
    throw new ApiError(422, 'invalid_save', '存档必须包含对象类型的 state。');
}
```
