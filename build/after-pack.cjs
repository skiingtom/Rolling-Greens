// electron-builder afterPack hook: stamp the game icon and version info into
// "Rolling Greens.exe" with resedit (pure JS), so Windows builds made on
// Linux/macOS get the right icon without needing Wine for rcedit.
const fs = require('node:fs')
const path = require('node:path')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return

  const { load } = require('resedit/cjs')
  const ResEdit = await load()

  const info = context.packager.appInfo
  const exePath = path.join(context.appOutDir, `${info.productFilename}.exe`)
  const icoPath = path.join(__dirname, 'icon.ico')

  const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true })
  const res = ResEdit.NtExecutableResource.from(exe)

  // Replace every icon group Electron ships with the game icon
  const icon = ResEdit.Data.IconFile.from(fs.readFileSync(icoPath))
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries)
  for (const g of groups) {
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
      res.entries,
      g.id,
      g.lang,
      icon.icons.map((i) => i.data),
    )
  }

  // Version resource: what Explorer shows under Properties → Details
  const [vi] = ResEdit.Resource.VersionInfo.fromEntries(res.entries)
  if (vi) {
    const [major, minor, patch] = info.version.split('.').map((n) => Number.parseInt(n, 10) || 0)
    vi.setFileVersion(major, minor, patch, 0, 1033)
    vi.setProductVersion(major, minor, patch, 0, 1033)
    for (const lang of vi.getAllLanguagesForStringValues()) {
      vi.setStringValues(lang, {
        ProductName: info.productName,
        FileDescription: info.productName,
        CompanyName: info.companyName || info.productName,
        LegalCopyright: info.copyright,
        OriginalFilename: `${info.productFilename}.exe`,
        InternalName: info.productFilename,
        FileVersion: info.version,
        ProductVersion: info.version,
      })
    }
    vi.outputToResourceEntries(res.entries)
  }

  res.outputResource(exe)
  fs.writeFileSync(exePath, Buffer.from(exe.generate()))
  console.log(`  • stamped icon + version info into ${path.basename(exePath)}`)
}
