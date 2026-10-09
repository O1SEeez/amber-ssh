// Keep geometry while SSH authentication and the shell request are in flight.
function validSize(cols,rows){return Number.isInteger(cols)&&Number.isInteger(rows)&&cols>=2&&rows>=1&&cols<=1000&&rows<=500;}
function createTerminalSize(initial){
  let size=validSize(initial?.cols,initial?.rows)?{cols:initial.cols,rows:initial.rows}:{cols:100,rows:30};
  let channel,applied;
  function sync(){if(channel&&(!applied||size.cols!==applied.cols||size.rows!==applied.rows)){channel.setWindow(size.rows,size.cols,0,0);applied={...size};}}
  return {
    snapshot:()=>({...size}),
    update(cols,rows){if(!validSize(cols,rows))return;size={cols,rows};sync();},
    attach(value,requested){channel=value;applied={...requested};sync();}
  };
}
module.exports={createTerminalSize};
