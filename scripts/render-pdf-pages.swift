import Foundation
import PDFKit
import AppKit

guard CommandLine.arguments.count == 4 else { fatalError("usage: render-pdf-pages PDF OUTPUT_PREFIX TEXT_OUTPUT") }
let pdfURL = URL(fileURLWithPath: CommandLine.arguments[1])
guard let document = PDFDocument(url: pdfURL) else { fatalError("unable to open PDF") }
var extracted = ""
for index in 0..<document.pageCount {
  guard let page = document.page(at: index) else { continue }
  extracted += (page.string ?? "") + "\n\n"
  let bounds = page.bounds(for: .mediaBox)
  let scale: CGFloat = 1.7
  let size = NSSize(width: bounds.width * scale, height: bounds.height * scale)
  let image = NSImage(size: size)
  image.lockFocus()
  NSColor.white.setFill()
  NSRect(origin: .zero, size: size).fill()
  guard let context = NSGraphicsContext.current?.cgContext else { fatalError("graphics context unavailable") }
  context.saveGState()
  context.scaleBy(x: scale, y: scale)
  page.draw(with: .mediaBox, to: context)
  context.restoreGState()
  image.unlockFocus()
  guard let tiff = image.tiffRepresentation,
        let bitmap = NSBitmapImageRep(data: tiff),
        let png = bitmap.representation(using: .png, properties: [:]) else { fatalError("PNG conversion failed") }
  let output = String(format: "%@-%02d.png", CommandLine.arguments[2], index + 1)
  try png.write(to: URL(fileURLWithPath: output))
}
try extracted.write(toFile: CommandLine.arguments[3], atomically: true, encoding: .utf8)
print(document.pageCount)
