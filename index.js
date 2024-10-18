// HTMS
const fs = require('fs');

let files = {};
let exp = {
  dynamicVars: false
};
let asyn = 0;

function getSample(con, name) {
  let reg = new RegExp(`<sample.*? name="${name}".*?>[^¬]+?</sample>`, 'm')
  return con.match(reg)[0].replace(/<sample.*?>|<\/sample>/gm, '')
}

function reshtms(res, file) {
  if (!fs.existsSync(file)) {
    throw new Error('File doesn\'t exist: '+file);
    return;
  }
  let con = fs.readFileSync(file,'utf8');
  if ((con.match(/<htms.*?>[^¬]*?<\/htms>/m)??[false])[0]) {
    let htms = con.match(/<htms.*?>[^¬]*?<\/htms>/m)[0];
    con = con.replaceAll(/<htms.*?>[^¬]*?<\/htms>/gm, '');
    htms = htms.split('\n');
    htms.slice(1,-1);
    htms = htms
      .map(e => e.trim())
      .filter(e => e.length);

    htms.forEach(async line => {
      let args = line.split(' ');
      let reg;
      let module;
      switch(args[0]) {
        case 'import':
          let ht = fs.readFileSync(args[3].replaceAll('"',''),'utf8');
          args[1].split(',').forEach(tt => {
            files[tt.replaceAll('"','')] = getSample(ht, tt.replaceAll('"',''));
          })
          break;
        case 'inject':
          reg = new RegExp(`<${args[1].replaceAll('"','')}.*?>[^¬]*?</${args[1].replaceAll('"','')}>`, 'gm')
          con = con.replaceAll(reg, function(match){
            let ch = match.replace(/>[^¬]*<\//m, '><').replace('>', '>'+files[args[3].replaceAll('"','')])
            if (match.includes(' var="')) {
              match.split(' var="')[1].split('"')[0].split(';').forEach(fd => {
                fd = fd.split(':')
                ch = ch.replaceAll('${'+fd[0]+'}', fd[1])
              })
            }
            return ch;
          })
          break;
        case 'replace':
          reg = new RegExp(`<${args[1].replaceAll('"','')}.*?>[^¬]*?</${args[1].replaceAll('"','')}>`, 'gm')
          con = con.replaceAll(reg, function(match){
            let ch = files[args[3].replaceAll('"','')];
            if (match.includes(' var="')) {
              match.split(' var="')[1].split('"')[0].split(';').filter(e=>e.length).forEach(fd => {
                fd = fd.split(':')
                ch = ch.replaceAll('${'+fd[0]+'}', fd[1])
              })
            }
            return ch;
          })
          break;
        case 'module':
          asyn += 1
          module = await fetch(`https://htms.fsh.plus/module/${args[1].replaceAll('"','')}/module.js`);
          module = await module.text();
          con += `<script>${module}</script>`;
          asyn -= 1;
          break;
        case 'exp':
          exp[args[1].replaceAll('"','')] = true;
      }
    })
  }

  if (exp.dynamicVars) {
    con += `<script>
  let events = [];
  let obs = [];
  Array.from(document.querySelectorAll('*[htms-out]')).forEach(u => {
    function upd() {
      document.querySelectorAll('*[htms-in="'+u.getAttribute('htms-out')+'"]').forEach(r => {
        let ch = (['input', 'textarea', 'select'].includes(u.tagName.toLocaleLowerCase()) ? u.value : u.innerHTML);
        (['input', 'textarea', 'select'].includes(r.tagName.toLocaleLowerCase()) ? r.value = ch : r.innerHTML = ch);
      });
    }

    let observer = new MutationObserver(function(){upd()})
    observer.observe(u, { attributes: true, childList: true, subtree: true });
    obs.push(observer);

    u.addEventListener('input', upd)
    events.push([u, upd])
  })
</script>`
  }

  function waitAsync() {
    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        if (asyn === 0) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  }
  (async() => {
    await waitAsync()
    res.send(con)
  })()
}

function mw(req, res, next) {
  res.htms = function(file){reshtms(res, file)}
  next()
}

module.exports = mw;
