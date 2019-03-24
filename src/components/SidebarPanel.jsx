import React from 'react';
import Paper from '@material-ui/core/Paper';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import ShuffleIcon from '@material-ui/icons/Shuffle';
import { withStyles } from '@material-ui/core';

const styles = theme => ({
  root : {
  },
  paper: {
    margin: 16,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
  },
  textField: {
    flex: 1,
    paddingBottom: 10,
  },
  button: {
    flex: 1,
  },
  label: {
    paddingLeft: 10,
  },
});

class SidebarPanel extends React.Component {
  
  constructor(props) {
    super(props);
  }

  render() {
    const { classes } = this.props;
    return (
      <Paper className={classes.paper}>
        <Typography variant="h5">Settings</Typography>
        <TextField
          label='Default Conveyor Speed'
          type='number'
          className={classes.textField}
          fullWidth
        >
        </TextField>

        <TextField
          label='Hard Drives'
          type='number'
          className={classes.textField}
          fullWidth
        >
        </TextField>

        <Button className={classes.button} fullWidth>
          <ShuffleIcon/>
          <div className={classes.label}>Rejiggle Graph</div>
        </Button>

      </Paper>
    );
  }
}

export default withStyles(styles) (SidebarPanel);