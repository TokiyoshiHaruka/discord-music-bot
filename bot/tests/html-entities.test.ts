import assert from "node:assert/strict";
import test from "node:test";

import { decodeHtmlEntities } from "../src/html-entities.js";

test("decodes every supported HTML entity once", () => {
  assert.equal(
    decodeHtmlEntities("Rock &amp; Roll &quot;Live&quot; &#39;Mix&#39; &apos;Alt&apos; &lt;set&gt;"),
    "Rock & Roll \"Live\" 'Mix' 'Alt' <set>"
  );
});

test("preserves surrounding plain text", () => {
  assert.equal(decodeHtmlEntities("before &lt;title&gt; after"), "before <title> after");
});

test("does not decode replacement output a second time", () => {
  assert.equal(
    decodeHtmlEntities("&amp;quot; &amp;lt; &amp;amp;"),
    "&quot; &lt; &amp;"
  );
});

test("leaves unknown and incomplete entities unchanged", () => {
  assert.equal(decodeHtmlEntities("&copy; &amp without-semicolon"), "&copy; &amp without-semicolon");
});
