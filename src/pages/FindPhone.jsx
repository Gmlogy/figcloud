// src/pages/FindPhone.jsx
import React, { Suspense } from "react";

// If you have the alias `@` -> `src`, this works:
const FindMyPhonePanel = React.lazy(() =>
  import("@/components/findmy/FindMyPhonePanel")
);

// If you don't have the alias set, use a relative path instead, e.g.:
// const FindMyPhonePanel = React.lazy(() =>
//   import("../components/findmy/FindMyPhonePanel")
// );

export default function FindPhone() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
      <FindMyPhonePanel />
    </Suspense>
  );
}
