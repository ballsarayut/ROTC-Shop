fetch("https://script.google.com/macros/s/AKfycbyCb7Byo0Zn8-VtxQ-6xwy0K0UR42s_8U4zcUfR6ReFl1ILZ18Nt-dvJLk1dd6VtgEI/exec?action=read&sheet=Orders")
  .then(res => {
    console.log('Status:', res.status);
    return res.text();
  })
  .then(text => console.log('Response length:', text.length))
  .catch(err => console.error('Error:', err));
