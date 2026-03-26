

# Fix Publish Build Failure

## Problem
The build fails because `@supabase/supabase-js` is imported in `src/integrations/supabase/client.ts` but is **not listed in `package.json` dependencies**.

## Fix
Add `@supabase/supabase-js` to the `dependencies` in `package.json`:

```json
"@supabase/supabase-js": "^2.49.4"
```

That's it — one line addition. The build will succeed after this.

