/**
 * Very basic JSON parser and stringifier for the CMS.
 * In a full version, we might use gray-matter for Markdown frontmatter parsing.
 */

export function parseFileContent(content: string, filePath: string) {
  if (filePath.endsWith(".json")) {
    try {
      return JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse JSON", e);
      return {};
    }
  }

  if (filePath.endsWith(".md") || filePath.endsWith(".mdx")) {
    // For now, a simple naive regex to extract frontmatter if present
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (match) {
      // In a real scenario, use yaml parser here
      const rawFrontmatter = match[1];
      const body = match[2];
      
      const frontmatter: Record<string, string> = {};
      rawFrontmatter.split("\n").forEach((line) => {
        const [key, ...valueParts] = line.split(":");
        if (key && valueParts.length > 0) {
          frontmatter[key.trim()] = valueParts.join(":").trim();
        }
      });
      return { _frontmatter: frontmatter, _body: body };
    }
    return { _body: content };
  }

  return { _raw: content };
}

export function stringifyFileContent(data: any, filePath: string) {
  if (filePath.endsWith(".json")) {
    return JSON.stringify(data, null, 2) + "\n";
  }

  if (filePath.endsWith(".md") || filePath.endsWith(".mdx")) {
    if (data._frontmatter) {
      let yaml = "---\n";
      for (const [key, val] of Object.entries(data._frontmatter)) {
        yaml += `${key}: ${val}\n`;
      }
      yaml += "---\n";
      return yaml + (data._body || "");
    }
    return data._body || "";
  }

  return data._raw || "";
}
