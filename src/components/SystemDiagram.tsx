import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface Node extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: 'user' | 'agent';
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node;
  target: string | Node;
  label: string;
}

const nodes: Node[] = [
  { id: 'user', name: 'User', type: 'user' },
  { id: 'pm', name: 'Project Manager', type: 'agent' },
  { id: 'researcher', name: 'Researcher', type: 'agent' },
  { id: 'writer', name: 'Writer', type: 'agent' },
  { id: 'editor', name: 'Editor', type: 'agent' },
  { id: 'ethics', name: 'Ethics Reviewer', type: 'agent' },
  { id: 'designer', name: 'Designer', type: 'agent' },
];

const links: Link[] = [
  { source: 'user', target: 'pm', label: 'Request' },
  { source: 'pm', target: 'user', label: 'Response' },
  { source: 'pm', target: 'researcher', label: 'Brief' },
  { source: 'researcher', target: 'pm', label: 'Insights' },
  { source: 'pm', target: 'writer', label: 'Drafting' },
  { source: 'writer', target: 'pm', label: 'Draft' },
  { source: 'pm', target: 'editor', label: 'Review' },
  { source: 'editor', target: 'pm', label: 'Feedback' },
  { source: 'pm', target: 'ethics', label: 'Audit' },
  { source: 'ethics', target: 'pm', label: 'Report' },
  { source: 'pm', target: 'designer', label: 'Format' },
  { source: 'designer', target: 'pm', label: 'Final' },
];

export default function SystemDiagram() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const width = 800;
    const height = 500;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('viewBox', [0, 0, width, height])
      .attr('width', '100%')
      .attr('height', '100%');

    // Arrowhead marker
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('xoverflow', 'visible')
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', '#999')
      .style('stroke', 'none');

    const simulation = d3.forceSimulation<Node>(nodes)
      .force('link', d3.forceLink<Node, Link>(links).id(d => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-1000))
      .force('center', d3.forceCenter(width / 2, height / 2));

    const link = svg.append('g')
      .selectAll('path')
      .data(links)
      .join('path')
      .attr('stroke', '#E5E5E5')
      .attr('stroke-width', 1.5)
      .attr('fill', 'none')
      .attr('marker-end', 'url(#arrowhead)');

    const linkLabels = svg.append('g')
      .selectAll('text')
      .data(links)
      .join('text')
      .attr('font-size', '8px')
      .attr('fill', '#999')
      .attr('text-anchor', 'middle')
      .attr('dy', -5)
      .text(d => d.label);

    const node = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .call(d3.drag<SVGGElement, Node>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    node.append('circle')
      .attr('r', 20)
      .attr('fill', d => d.type === 'user' ? '#1A1A1A' : '#FFF')
      .attr('stroke', d => d.type === 'user' ? '#1A1A1A' : '#E5E5E5')
      .attr('stroke-width', 2)
      .attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.05))');

    node.append('text')
      .attr('dy', 35)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('fill', '#333')
      .text(d => d.name);

    // Add icons (simplified as text for now, or could use Lucide icons as foreignObject)
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 5)
      .attr('font-size', '12px')
      .attr('fill', d => d.type === 'user' ? '#FFF' : '#666')
      .text(d => d.type === 'user' ? '👤' : '🤖');

    simulation.on('tick', () => {
      link.attr('d', d => {
        const source = d.source as Node;
        const target = d.target as Node;
        
        // Curved paths for bidirectional links
        const dx = target.x! - source.x!;
        const dy = target.y! - source.y!;
        const dr = Math.sqrt(dx * dx + dy * dy) * 1.5;
        return `M${source.x},${source.y}A${dr},${dr} 0 0,1 ${target.x},${target.y}`;
      });

      linkLabels
        .attr('x', d => {
          const source = d.source as Node;
          const target = d.target as Node;
          return (source.x! + target.x!) / 2 + (target.y! - source.y!) * 0.1;
        })
        .attr('y', d => {
          const source = d.source as Node;
          const target = d.target as Node;
          return (source.y! + target.y!) / 2 - (target.x! - source.x!) * 0.1;
        });

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, []);

  return (
    <div className="w-full h-full bg-[#FDFCFB] rounded-3xl border border-[#E5E5E5] overflow-hidden">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}
