const PAGE_ID = "645371045317681";
const GRAPH_VERSION = "v26.0";
const MAX_PHOTOS = 150;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300"
    }
  });
}

async function getFacebookPhotos(env) {
  if (!env.FB_PAGE_ACCESS_TOKEN) {
    throw new Error("FB_PAGE_ACCESS_TOKEN is not configured");
  }

  const photos = [];
  const seen = new Set();
  let after = null;

  // Read several Facebook pages if necessary.
  for (let page = 0; page < 5 && photos.length < MAX_PHOTOS; page++) {
    const url = new URL(
      `https://graph.facebook.com/${GRAPH_VERSION}/${PAGE_ID}/photos`
    );

    url.searchParams.set("type", "uploaded");
    url.searchParams.set("fields", "id,images,created_time");
    url.searchParams.set("limit", "100");

    if (after) {
      url.searchParams.set("after", after);
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${env.FB_PAGE_ACCESS_TOKEN}`
      }
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(
        data?.error?.message || `Facebook API returned ${response.status}`
      );
    }

    for (const photo of data.data || []) {
      if (!photo.id || seen.has(photo.id)) continue;

      const images = Array.isArray(photo.images) ? photo.images : [];

      // Select the largest version Facebook gives us.
      const best = images.reduce((largest, current) => {
        if (!largest) return current;

        const largestSize =
          (largest.width || 0) * (largest.height || 0);

        const currentSize =
          (current.width || 0) * (current.height || 0);

        return currentSize > largestSize ? current : largest;
      }, null);

      if (!best?.source) continue;

      seen.add(photo.id);

      photos.push({
        id: photo.id,
        src: best.source,
        width: best.width || null,
        height: best.height || null,
        created_time: photo.created_time || null
      });
    }

    if (!data.paging?.next || !data.paging?.cursors?.after) {
      break;
    }

    after = data.paging.cursors.after;
  }

  photos.sort((a, b) => {
    return new Date(b.created_time || 0) - new Date(a.created_time || 0);
  });

  return photos.slice(0, MAX_PHOTOS);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/facebook-gallery") {
      try {
        const photos = await getFacebookPhotos(env);

        return json({
          count: photos.length,
          photos
        });
      } catch (error) {
        console.error("Facebook gallery error:", error);

        return json(
          {
            error: "Unable to load Facebook gallery",
            detail: error.message
          },
          500
        );
      }
    }

    return env.ASSETS.fetch(request);
  }
};
