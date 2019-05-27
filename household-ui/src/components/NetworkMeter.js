import React, { useState } from "react";
import PropTypes from "prop-types";
import { Box, Stack, Meter, Text } from "grommet";

const NetworkMeter = ({
  total,
  householdShare,
  colors,
  totalLabel = "total"
}) => {
  const [value, setValue] = useState(total);
  const [label, setLabel] = useState(totalLabel);

  const handleHover = (isHovering, valueToShow, labelToShow) => {
    setValue(isHovering ? valueToShow : 0);
    setLabel(isHovering ? labelToShow : null);
  };

  return (
    <Box align="center" pad="large">
      <Stack anchor="center">
        <Meter
          type="circle"
          values={[
            {
              value: total - householdShare,
              color: colors[0],
              onHover: isHovering =>
                handleHover(isHovering, total - householdShare, "by others")
            },
            {
              value: householdShare,
              color: colors[1],
              onHover: isHovering =>
                handleHover(isHovering, householdShare, "by you")
            }
          ]}
          max={total}
          size="small"
          thickness="medium"
        />
        <Box align="center">
          <Box direction="row" align="center" pad={{ bottom: "xsmall" }}>
            <Text size="xxlarge" weight="bold">
              {value || total}
            </Text>
            <Text>kWh</Text>
          </Box>
          <Text>{label || totalLabel}</Text>
        </Box>
      </Stack>
    </Box>
  );
};

NetworkMeter.propTypes = {
  total: PropTypes.number,
  totalLabel: PropTypes.string,
  householdShare: PropTypes.number,
  colors: PropTypes.arrayOf(PropTypes.string)
};

export default NetworkMeter;
