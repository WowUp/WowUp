if (!process.isMainFrame) {
  throw new Error("Preload scripts should not be running in a subframe");
}

if (window.open === null) {
  console.log("NO OPENER");
} else {
  console.log("HAS OPENER");
}
