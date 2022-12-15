import React, { useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { cutAddress } from 'utils/address/helper';
import Link from 'next/link';
const LeaderboardComponent = (props) => {
  const { teamName, teamScore, index, accountId, gameId } = props;

  return (
    <div className="flex flex-row mb-6" key={index}>
      <div
        className={`w-10 flex items-center justify-center font-monument text-2xl ${
          index + 1 > 3 ? 'text-indigo-white font-outline-1' : ''
        }`}
      >
        {index + 1 <= 9 ? '0' + (index + 1) : index + 1}
      </div>
      <div
        className="flex items-center justify-center ml-6 bg-indigo-black text-indigo-white
        w-1/2 text-center p-1 text-base font-monument"
      >
        {teamName} {cutAddress(accountId)}
      </div>
      <div className="flex items-center justify-center ml-6 w-12 text-center content-center font-black">
        {teamScore?.toFixed(2)}
      </div>
      <div className="flex items-center justify-center ml-6">
        <Link
          href={{
            pathname: '/EntrySummary/[game_id]',
            query: {
              team_id: teamName,
              game_id: gameId,
            },
          }}
          as={`/EntrySummary/${gameId}/${teamName}`}
        >
          <a>
            <img className="filter invert" src={'/images/arrow-top-right.png'} />
          </a>
        </Link>
      </div>
    </div>
  );
};

LeaderboardComponent.propTypes = {
  teamName: PropTypes.string,
  teamScore: PropTypes.number,
  index: PropTypes.number,
  accountId: PropTypes.string,
  gameId: PropTypes.number,
};
export default LeaderboardComponent;
