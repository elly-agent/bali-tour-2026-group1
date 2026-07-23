// みんなの写真（ミニミニミニインスタ）用の、ごく簡易な裏側の仕組み。
// 会員登録なし・パスワードなしで、その場で投稿・閲覧だけできるシンプルな作りにしている。
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/photos" && request.method === "GET") {
      const list = await env.PHOTOS_BUCKET.list({ prefix: "photos/", limit: 100 });
      const items = list.objects
        .map((obj) => ({
          key: obj.key,
          uploaded: obj.uploaded,
          name: (obj.customMetadata && obj.customMetadata.name) || "",
          caption: (obj.customMetadata && obj.customMetadata.caption) || "",
        }))
        .sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));
      return new Response(JSON.stringify(items), {
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    if (url.pathname === "/api/photos" && request.method === "POST") {
      try {
        const form = await request.formData();
        const file = form.get("photo");
        const name = String(form.get("name") || "").slice(0, 40);
        const caption = String(form.get("caption") || "").slice(0, 200);
        if (!file || typeof file === "string") {
          return new Response(JSON.stringify({ error: "写真が選択されていません" }), { status: 400 });
        }
        if (file.size > 8 * 1024 * 1024) {
          return new Response(JSON.stringify({ error: "写真のサイズが大きすぎます（8MBまで）" }), { status: 400 });
        }
        const key = "photos/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
        await env.PHOTOS_BUCKET.put(key, file.stream(), {
          httpMetadata: { contentType: file.type || "image/jpeg" },
          customMetadata: { name: name, caption: caption },
        });
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: "アップロードに失敗しました" }), { status: 500 });
      }
    }

    if (url.pathname.startsWith("/photo-file/")) {
      const key = decodeURIComponent(url.pathname.slice("/photo-file/".length));
      const obj = await env.PHOTOS_BUCKET.get(key);
      if (!obj) return new Response("not found", { status: 404 });
      return new Response(obj.body, {
        headers: {
          "content-type": (obj.httpMetadata && obj.httpMetadata.contentType) || "image/jpeg",
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    }

    // 上記以外は、これまで通り静的サイト（HTML/CSS/JS/画像）をそのまま返す
    return env.ASSETS.fetch(request);
  },
};
