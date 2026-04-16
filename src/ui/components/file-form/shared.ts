export function getUrl(
  file: File | string,
  collectionId: string,
  recordId: string,
  thumb: string,
) {
  return typeof file === "string"
    ? `/api/files/${collectionId}/${recordId}/${file}?thumb=${thumb}`
    : URL.createObjectURL(file);
}

export function getName(file: File | string) {
  return typeof file === "string" ? (file.split("/").pop() ?? "") : file.name;
}
