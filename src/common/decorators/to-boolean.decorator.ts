import { Transform } from 'class-transformer';

/** Correctly parses a query-string boolean. Type(()=>Boolean) alone is a real bug — Boolean("false") is true in JS, so `?flag=false` would previously be read as true. Apply on every boolean query param. */
export function ToBoolean() {
  return Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return undefined;
  });
}
