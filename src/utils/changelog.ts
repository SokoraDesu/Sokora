type TDate = `${number}/${number}/${number}`;
type TVersion = TDate | "Work in progress";
interface TParsedVersion {
  minor: boolean;
  ver: string;
  codename: null | string;
  date: TVersion;
}
type TParsedChangelog = TParsedVersion & {
  body: Record<"Fixed" | "Added" | "Removed" | "Changed", string>;
};
const changelog = await Bun.file("./CHANGELOG.md").text();

/**
 * Gets the changelog of a specified Sokora version (directly from CHANGELOG.md).
 *
 * @param ver Version to get changelog for.
 * @returns An object with changelog data.
 */
export function getChangelog(version: string): TParsedChangelog {
  const _ = changelog.split("\n").filter(s => !s.startsWith("<!--"));
  const index = _.findIndex(s => s.startsWith(`## ${version}`));
  const index2 = _.slice(index).filter(s => s.trim() !== "");
  const index3 = index2.slice(1).findIndex(s => s.startsWith("## "));
  const lines = index2.slice(0, (index3 === -1 ? index2.length : index3 + 1) + 1);
  const base = lines.slice(1);
  const categories = base.filter(s => s.startsWith("### ")).map(s => s.replace("### ", ""));
  const entries: [keyof TParsedChangelog["body"], string][] = [];
  for (const cat of categories) {
    const index = base.findIndex(s => s.startsWith("### " + cat));
    const index2_ = base.slice(index + 1).findIndex(s => s.startsWith("### "));
    const newBase = base
      .slice(index, index2_ === -1 ? base.length : index + 1 + index2_)
      .slice(1)
      .filter(s => !s.startsWith("## ")) // patch
      .join("\n");
    if (newBase !== "") entries.push([cat as keyof TParsedChangelog["body"], newBase]);
  }

  return {
    ...parseVersion(lines[0]),
    body: Object.fromEntries(entries) as TParsedChangelog["body"],
  };
}

function parseVersion(string_: string): TParsedVersion {
  const [version, codename, date] = string_.replace("## ", "").split(" - ");
  const minor = version.endsWith(".0");
  if (!date) return { ver: version, date: codename as TDate, minor, codename: null };
  return { ver: version, date: date as TDate, codename, minor };
}

/**
 * Gets a list of all released versions.
 *
 * @returns An array of objects telling you the version, the date, and whether it's a minor or a patch release (SemVer-wise).
 */
export function getVersions(): TParsedVersion[] {
  const res: TParsedVersion[] = [];

  changelog
    .split("\n")
    .filter(s => s.startsWith("## "))
    .map(s => {
      res.push(parseVersion(s));
    });

  return res;
}
