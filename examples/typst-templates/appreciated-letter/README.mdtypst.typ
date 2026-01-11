// Letter layout (Typst package: appreciated-letter)

#import "@preview/appreciated-letter:0.1.0": letter

#let sender = mdtypst_text_or_none(mdtypst.meta.sender)
#let recipient = mdtypst_block_from_escaped_newlines(mdtypst.meta.recipient)
#let date = if mdtypst.date != none { mdtypst.date } else { mdtypst.meta.date }
#let subject = if mdtypst.meta.subject != none { mdtypst.meta.subject } else { mdtypst.title }
#let name = mdtypst_block_from_escaped_newlines(if mdtypst.meta.name != none { mdtypst.meta.name } else { mdtypst.author })

#show: letter.with(
  sender: sender,
  recipient: recipient,
  date: mdtypst_text_or_none(date),
  subject: mdtypst_text_or_none(subject),
  name: name,
)
